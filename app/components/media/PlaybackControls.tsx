import React, { Component } from 'react';
import styles from './PlaybackControls.css';
import { PlaybackState, IMediaItem } from 'lobby/reducers/mediaPlayer';
import { Time } from 'components/media/Time';
import { ProgressSlider } from 'components/media/ProgressSlider';
import { VolumeSlider } from 'components/media/VolumeSlider';

interface IProps {
  media?: IMediaItem;
  startTime?: number;
  playback: PlaybackState;
  playPause?: React.MouseEventHandler<HTMLButtonElement>;
  next?: React.MouseEventHandler<HTMLButtonElement>;
  seek?: (ms: number) => void;
  reload?: React.MouseEventHandler<HTMLButtonElement>;
  debug?: React.MouseEventHandler<HTMLButtonElement>;
}

export class PlaybackControls extends Component<IProps> {
  render(): JSX.Element | null {
    const { playback, media, startTime } = this.props;
    const playbackIcon = playback === PlaybackState.Playing ? '⏸️' : '▶️';

    const disabled = playback === PlaybackState.Idle;
    const duration = (media && media.duration) || 0;

    return (
      <div className={styles.container}>
        <button type="button" className={styles.button} onClick={this.props.playPause}>
          {playbackIcon}
        </button>
        <button type="button" title="Next" className={styles.button} onClick={this.props.next}>
          ⏭️
        </button>
        {!disabled && <Time className={styles.time} time={startTime || 0} realTime />}
        <ProgressSlider
          startTime={startTime || 0}
          duration={duration}
          disabled={disabled}
          onChange={this.onSliderChange}
        />
        {!disabled && <Time className={styles.time} time={(media && media.duration) || 0} />}
        <VolumeSlider volume={0.5} />
        <button type="button" className={styles.button} title="Reload" onClick={this.props.reload}>
          🔄
        </button>
        <button type="button" className={styles.button} title="Debug" onClick={this.props.debug}>
          🛠️
        </button>
      </div>
    );
  }

  private onSliderChange = (progress: number): void => {
    const { media } = this.props;
    const duration = (media && media.duration) || 0;
    const time = duration * progress;

    if (this.props.seek) {
      this.props.seek(time);
    }
  };
}
