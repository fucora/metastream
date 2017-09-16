import React, { Component } from 'react';
import { clamp } from 'utils/math';
import { Slider } from 'components/media/Slider';

import styles from './VolumeSlider.css';

interface IProps {
  volume: number;
  onChange?: (volume: number) => void;
}

export class VolumeSlider extends Component<IProps> {
  render(): JSX.Element | null {
    return (
      <div className={styles.container}>
        <div>🔊</div>
        <Slider
          className={styles.slider}
          value={this.props.volume}
          onChange={this.props.onChange}
        />
      </div>
    );
  }
}
