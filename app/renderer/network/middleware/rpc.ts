import { Middleware, MiddlewareAPI, Action, Dispatch } from 'redux'
import { ActionCreator } from 'redux'

import { NetConnection, NetServer, localUser, localUserId } from 'renderer/network'
import { NetMiddlewareOptions, NetActions } from 'renderer/network/actions'
import { isType } from 'utils/redux'

const RpcReduxActionTypes = {
  DISPATCH: '@@rpc/DISPATCH'
}

type RpcMiddlewareResult = boolean

interface IRpcThunkContext {
  client: NetConnection
  host: boolean
  server: NetServer
}

export type RpcThunkAction<R, S> = (
  dispatch: Dispatch<S>,
  getState: () => S,
  context: IRpcThunkContext
) => R

const isRpcThunk = (arg: any): arg is RpcThunkAction<any, any> => typeof arg === 'function'

export interface NetRpcMiddlewareOptions {
  server: NetServer
  host: boolean
}

const RPC_HEADER = 'RPC'

export const netRpcMiddleware = (): Middleware => {
  return <S extends Object>(store: MiddlewareAPI<S>) => {
    const { dispatch, getState } = store

    let server: NetServer | null, host: boolean

    const init = (options: NetMiddlewareOptions) => {
      console.log('[RPC] Init middleware', options)

      server = options.server
      host = options.host

      // Listen for RPCs and dispatch them
      server.on('data', receive)
    }

    const destroy = () => {
      server = null
      host = false
    }

    const receive = (client: NetConnection, data: Buffer) => {
      if (data.indexOf(RPC_HEADER) !== 0) {
        return
      }

      const jsonStr = data.toString('utf-8', RPC_HEADER.length)
      const json = JSON.parse(jsonStr)

      const action = {
        type: RpcReduxActionTypes.DISPATCH,
        payload: {
          name: json.name,
          args: json.args
        }
      }

      console.info(`[RPC] Received RPC '#${action.type}' from ${client.id}`, action)

      dispatchRpc(action, client)
    }

    /** Send RPC to recipients. */
    const sendRpc = (action: RpcAction) => {
      const { payload, clients } = action
      const rpc = getRpc(payload.name)!

      const json = JSON.stringify(payload)
      const buf = new Buffer(RPC_HEADER + json)

      switch (rpc.realm) {
        case RpcRealm.Server:
          server!.sendToHost(buf)
          break
        case RpcRealm.Multicast:
          server!.send(buf)
          break
        case RpcRealm.Client:
          clients!.forEach(clientId => {
            if (clientId === localUserId()) {
              dispatchRpc(action, localUser())
            } else {
              server!.sendTo(clientId, buf)
            }
          })
          break
      }
    }

    /** Dispatch RPC on local Redux store. */
    const dispatchRpc = (action: RpcAction, client: NetConnection) => {
      const result = execRpc(action, client)

      if (isRpcThunk(result)) {
        const context = { client, host, server: server! }
        result(dispatch, getState, context)
      } else if (typeof result === 'object') {
        dispatch(result as Action)
      } else if (typeof result === 'string') {
        console.error(result)
      }
    }

    return (next: Dispatch<S>) => <A extends RpcAction>(
      action: A
    ): Action | RpcMiddlewareResult => {
      if (isType(action, NetActions.connect)) {
        init(action.payload)
        return next(<A>action)
      } else if (isType(action, NetActions.disconnect)) {
        destroy()
        return next(<A>action)
      }

      // TODO: check for RPC special prop
      if (action.type !== RpcReduxActionTypes.DISPATCH) {
        return next(action)
      }

      const rpcName = action.payload.name
      const rpc = getRpc(rpcName)

      if (!rpc) {
        throw new Error(`[RPC] Attempted to dispatch unknown RPC '${rpcName}'`)
      }

      // https://docs.unrealengine.com/latest/INT/Gameplay/Networking/Actors/RPCs/#rpcinvokedfromtheserver
      switch (rpc.realm) {
        case RpcRealm.Server:
          // SERVER: dispatch
          // CLIENT: send to server
          if (host) {
            dispatchRpc(action, localUser())
          } else {
            sendRpc(action)
          }
          break
        case RpcRealm.Client:
          // SERVER: dispatch
          // CLIENT: throw
          if (host) {
            sendRpc(action)
          } else {
            throw new Error(`Client RPC '${action.type}' dispatched on client`)
          }
          break
        case RpcRealm.Multicast:
          // SERVER: broadcast and dispatch
          // CLIENT: dispatch
          if (host) {
            sendRpc(action)
          }
          dispatchRpc(action, localUser())
          break
      }

      return true
    }
  }
}

//
// RPC FUNCTION WRAPPER
//

export const enum RpcRealm {
  Server = 'server',
  Client = 'client',
  Multicast = 'multicast'
}

type RecipientFilter = string[]

interface RpcAction extends Action {
  clients?: RecipientFilter
  payload: {
    name: string
    args: any[]
  }
}

interface IRPCOptions {
  validate?: (...args: any[]) => boolean
  allowUnauthed?: boolean
}

interface IRPC extends IRPCOptions {
  realm: RpcRealm
  action: Function
}

const rpcMap: { [key: string]: IRPC | undefined } = {}

const getRpc = (name: string) => rpcMap[name]

const execRpc = <T>({ payload }: RpcAction, client: NetConnection): T | string => {
  const { name, args } = payload

  if (!rpcMap.hasOwnProperty(name)) {
    throw new Error(`Exec unknown RPC "${name}"`)
  }

  const opts = rpcMap[name]!

  if (!client.isAuthed() && !opts.allowUnauthed) {
    return `Client not authorized to dispatch RPC "${name}"`
  }

  if (opts.validate && !opts.validate(args)) {
    return `Invalidate arguments for RPC "${name}"`
  }

  return opts.action.apply(null, args)
}

// prettier-ignore
export function rpc<TResult>(realm: RpcRealm.Multicast | RpcRealm.Server, action: () => TResult, opts?: IRPCOptions): (() => ActionCreator<void>);
// prettier-ignore
export function rpc<T1, TResult>(realm: RpcRealm.Multicast | RpcRealm.Server, action: (a: T1) => TResult, opts?: IRPCOptions): ((a: T1) => ActionCreator<void>);
// prettier-ignore
export function rpc<T1, T2, TResult>(realm: RpcRealm.Multicast | RpcRealm.Server, action: (a: T1, b: T2) => TResult, opts?: IRPCOptions): ((a: T1, b: T2) => ActionCreator<void>);
// prettier-ignore
export function rpc<T1, T2, T3, TResult>(realm: RpcRealm.Multicast | RpcRealm.Server, action: (a: T1, b: T2, c: T3) => TResult, opts?: IRPCOptions): ((a: T1, b: T2, c: T3) => ActionCreator<void>);
// prettier-ignore
export function rpc<TResult>(realm: RpcRealm.Client, action: () => TResult, opts?: IRPCOptions): (() => (...clients: RecipientFilter) => ActionCreator<void>);
// prettier-ignore
export function rpc<T1, TResult>(realm: RpcRealm.Client, action: (a: T1) => TResult, opts?: IRPCOptions): ((a: T1) => (...clients: RecipientFilter) => ActionCreator<void>);
// prettier-ignore
export function rpc<T1, T2, TResult>(realm: RpcRealm.Client, action: (a: T1, b: T2) => TResult, opts?: IRPCOptions): ((a: T1, b: T2) => (...clients: RecipientFilter) => ActionCreator<void>);
// prettier-ignore
export function rpc<T1, T2, T3, TResult>(realm: RpcRealm.Client, action: (a: T1, b: T2, c: T3) => TResult, opts?: IRPCOptions): ((a: T1, b: T2, c: T3) => (...clients: RecipientFilter) => ActionCreator<void>);
// prettier-ignore
export function rpc(realm: RpcRealm, action: (...args: any[]) => any, opts?: IRPCOptions): Function {
  const { name } = action

  if (name === 'action') {
    throw new Error('Invalid RPC action name, must define function name.')
  }

  // Register global RPC handler
  if (rpcMap.hasOwnProperty(name)) {
    console.warn(`RPC action name ("${name}") collides with existing action, overriding...`)
  }

  rpcMap[name] = { ...opts, realm, action }

  // Return Redux action creator;
  // intercepted by redux-rpc middleware
  let proxy

  if (realm === RpcRealm.Client) {
    proxy = (...args: any[]) => (...clients: RecipientFilter) =>
      ({
        type: RpcReduxActionTypes.DISPATCH,
        clients,
        payload: {
          name: name,
          args: args
        },
      } as RpcAction)
  } else {
    proxy = (...args: any[]) =>
      ({
        type: RpcReduxActionTypes.DISPATCH,
        payload: {
          name: name,
          args: args
        }
      } as RpcAction)
  }

  return proxy
}
