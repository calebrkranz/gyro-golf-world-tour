# Stadium design reference

Primary reference: Retro League GX, https://github.com/mholtkamp/retro-league (MIT license).
Reviewed Rocket/Source/Car.cpp (UpdateCamera, UpdateJump) and Rocket/Source/Ball.cpp.

Reference concepts applied independently in the existing JavaScript engine:
- Camera yaw follows the shortest angular path with a bounded turn speed and smoothing.
- A ground-projected ball shadow helps judge aerial height and landing position.

No upstream source or art assets are bundled. Existing stadium gravity, directional dash,
server-authoritative multiplayer, golf and Phyphox behavior remain unchanged in this pass.

Search snapshot: GitHub reported 55 stars for Retro League GX, 24 for Pocket League,
5 for Wocket-Weague, 311 for RoboLeague and 158 for RocketSim. These are repository
stars, not player counts or a comprehensive popularity ranking. RoboLeague's current
README describes ML experiments and says the soccer gameplay scene was removed.

Follow-up: independently implemented forward/lateral grip, acceleration and braking,
normal-based ball impacts, slope-normal bounces, and direction-preserving soft/hard ball speed limits.
Stadium drive speed is 330, boost speed 480; ball gravity stays 285 and directional dash stays flat.
