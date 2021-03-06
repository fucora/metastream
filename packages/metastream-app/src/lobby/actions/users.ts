import { actionCreator } from 'utils/redux'
import { RpcThunk } from 'lobby/types'
import { getUserName, isAdmin, getUser, hasRole } from 'lobby/reducers/users.helpers'
import { rpc, RpcRealm } from 'network/middleware/rpc'
import { localUserId } from 'network'
import { addChat } from './chat'
import { NetworkDisconnectReason } from 'constants/network'
import { setDisconnectReason } from './session'
import { UserRole, IUserInvite } from '../reducers/users'
import { translateEscaped } from 'locale'

export const addUserInvite = actionCreator<IUserInvite>('ADD_USER_INVITE')
export const answerUserInvite = actionCreator<IUserInvite & { response: string }>(
  'ANSWER_USER_INVITE'
)

export const setUserRole = actionCreator<{ userId: string; role: UserRole; enabled: boolean }>(
  'SET_USER_ROLE'
)

const userJoined = (userId: string): RpcThunk<void> => (dispatch, getState, context) => {
  if (localUserId() === userId) {
    return
  }

  const username = getUserName(getState(), userId)
  const content = translateEscaped('userJoined', { userId, username })
  dispatch(addChat({ content, html: true, timestamp: Date.now() }))
}
export const multi_userJoined = rpc('userJoined', RpcRealm.Multicast, userJoined)

const userLeft = (userId: string): RpcThunk<void> => (dispatch, getState, context) => {
  const username = getUserName(getState(), userId)
  const content = translateEscaped('userLeft', { userId, username })
  dispatch(addChat({ content, html: true, timestamp: Date.now() }))
}
export const multi_userLeft = rpc('userLeft', RpcRealm.Multicast, userLeft)

const kickClient = (reason: NetworkDisconnectReason): RpcThunk<void> => (
  dispatch,
  getState,
  { server }
) => {
  console.debug(`Received kick with reason: '${reason}'`)
  dispatch(setDisconnectReason(reason))
  server.close()
}
export const client_kick = rpc('kickClient', RpcRealm.Client, kickClient)

const kickUser = (targetId: string): RpcThunk<void> => (dispatch, getState, context) => {
  const state = getState()
  const requesterId = context.client.id.toString()

  if (requesterId === targetId) return
  if (!isAdmin(state, requesterId)) return

  const target = getUser(state, targetId)
  if (target) {
    dispatch(client_kick(NetworkDisconnectReason.Kicked)(targetId))

    const conn = context.server.getClientById(targetId)
    if (conn) {
      conn.close()
    }
  }
}
export const server_kickUser = rpc('kickUser', RpcRealm.Server, kickUser)

const toggleUserRole = (targetId: string, role: UserRole): RpcThunk<void> => (
  dispatch,
  getState,
  context
) => {
  const state = getState()
  const requesterId = context.client.id.toString()

  if (requesterId === targetId) return
  if (!isAdmin(state, requesterId)) return

  dispatch(
    setUserRole({
      userId: targetId,
      role,
      enabled: !hasRole(state, targetId, role)
    })
  )
}
export const server_toggleUserRole = rpc('toggleUserRole', RpcRealm.Server, toggleUserRole)
