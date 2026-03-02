import React from 'react';
import { Composition } from 'remotion';
import { HeroIntro } from './compositions/HeroIntro';
import { ModesJarvis } from './compositions/ModesJarvis';
import { ModesAgent } from './compositions/ModesAgent';
import { ModesMonitor } from './compositions/ModesMonitor';
import { SpiralMemory } from './compositions/SpiralMemory';
import { Brain3D } from './compositions/Brain3D';
import { GettingStarted } from './compositions/GettingStarted';
import { FeaturesOverview } from './compositions/FeaturesOverview';
import { WIDTH, HEIGHT, FPS, seconds } from './utils/layout';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HeroIntro"
        component={HeroIntro}
        durationInFrames={seconds(30)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="ModesJarvis"
        component={ModesJarvis}
        durationInFrames={seconds(20)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="ModesAgent"
        component={ModesAgent}
        durationInFrames={seconds(20)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="ModesMonitor"
        component={ModesMonitor}
        durationInFrames={seconds(20)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="SpiralMemory"
        component={SpiralMemory}
        durationInFrames={seconds(30)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="Brain3D"
        component={Brain3D}
        durationInFrames={seconds(25)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="GettingStarted"
        component={GettingStarted}
        durationInFrames={seconds(45)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="FeaturesOverview"
        component={FeaturesOverview}
        durationInFrames={seconds(30)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
