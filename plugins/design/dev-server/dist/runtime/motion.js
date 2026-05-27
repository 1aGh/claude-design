var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion/lib/index.mjs
var exports_lib = {};
__export(exports_lib, {
  wrap: () => wrap,
  transform: () => transform,
  time: () => time,
  sync: () => sync,
  steps: () => steps,
  stagger: () => stagger,
  spring: () => spring,
  scrollInfo: () => scrollInfo,
  scroll: () => scroll,
  reverseEasing: () => reverseEasing,
  progress: () => progress,
  pipe: () => pipe,
  noop: () => noop,
  motionValue: () => motionValue,
  mix: () => mix,
  mirrorEasing: () => mirrorEasing,
  keyframes: () => keyframes,
  isDragActive: () => isDragActive,
  invariant: () => invariant,
  interpolate: () => interpolate,
  inertia: () => inertia,
  inView: () => inView,
  frameSteps: () => frameSteps,
  frameData: () => frameData,
  frame: () => frame,
  easeOut: () => easeOut,
  easeInOut: () => easeInOut,
  easeIn: () => easeIn,
  distance2D: () => distance2D,
  distance: () => distance,
  delay: () => delayInSeconds,
  cubicBezier: () => cubicBezier,
  createScopedAnimate: () => createScopedAnimate,
  clamp: () => clamp,
  circOut: () => circOut,
  circInOut: () => circInOut,
  circIn: () => circIn,
  cancelSync: () => cancelSync,
  cancelFrame: () => cancelFrame,
  backOut: () => backOut,
  backInOut: () => backInOut,
  backIn: () => backIn,
  anticipate: () => anticipate,
  animateMini: () => animateMini,
  animate: () => animate,
  MotionValue: () => MotionValue
});

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/gestures/drag/state/is-active.mjs
var isDragging = {
  x: false,
  y: false
};
function isDragActive() {
  return isDragging.x || isDragging.y;
}
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-utils/dist/es/noop.mjs
var noop = (any) => any;

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-utils/dist/es/errors.mjs
var warning = noop;
var invariant = noop;
if (false) {}
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-utils/dist/es/progress.mjs
var progress = (from, to, value) => {
  const toFromDifference = to - from;
  return toFromDifference === 0 ? 1 : (value - from) / toFromDifference;
};
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-utils/dist/es/memo.mjs
function memo(callback) {
  let result;
  return () => {
    if (result === undefined)
      result = callback();
    return result;
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/utils/supports/scroll-timeline.mjs
var supportsScrollTimeline = memo(() => window.ScrollTimeline !== undefined);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/animation/controls/BaseGroup.mjs
class BaseGroupPlaybackControls {
  constructor(animations) {
    this.stop = () => this.runAll("stop");
    this.animations = animations.filter(Boolean);
  }
  get finished() {
    return Promise.all(this.animations.map((animation) => ("finished" in animation) ? animation.finished : animation));
  }
  getAll(propName) {
    return this.animations[0][propName];
  }
  setAll(propName, newValue) {
    for (let i = 0;i < this.animations.length; i++) {
      this.animations[i][propName] = newValue;
    }
  }
  attachTimeline(timeline, fallback) {
    const subscriptions = this.animations.map((animation) => {
      if (supportsScrollTimeline() && animation.attachTimeline) {
        return animation.attachTimeline(timeline);
      } else if (typeof fallback === "function") {
        return fallback(animation);
      }
    });
    return () => {
      subscriptions.forEach((cancel, i) => {
        cancel && cancel();
        this.animations[i].stop();
      });
    };
  }
  get time() {
    return this.getAll("time");
  }
  set time(time) {
    this.setAll("time", time);
  }
  get speed() {
    return this.getAll("speed");
  }
  set speed(speed) {
    this.setAll("speed", speed);
  }
  get startTime() {
    return this.getAll("startTime");
  }
  get duration() {
    let max = 0;
    for (let i = 0;i < this.animations.length; i++) {
      max = Math.max(max, this.animations[i].duration);
    }
    return max;
  }
  runAll(methodName) {
    this.animations.forEach((controls) => controls[methodName]());
  }
  flatten() {
    this.runAll("flatten");
  }
  play() {
    this.runAll("play");
  }
  pause() {
    this.runAll("pause");
  }
  cancel() {
    this.runAll("cancel");
  }
  complete() {
    this.runAll("complete");
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/animation/controls/Group.mjs
class GroupPlaybackControls extends BaseGroupPlaybackControls {
  then(onResolve, onReject) {
    return Promise.all(this.animations).then(onResolve).catch(onReject);
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-utils/dist/es/time-conversion.mjs
var secondsToMilliseconds = (seconds) => seconds * 1000;
var millisecondsToSeconds = (milliseconds) => milliseconds / 1000;

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/animation/generators/utils/calc-duration.mjs
var maxGeneratorDuration = 20000;
function calcGeneratorDuration(generator) {
  let duration = 0;
  const timeStep = 50;
  let state = generator.next(duration);
  while (!state.done && duration < maxGeneratorDuration) {
    duration += timeStep;
    state = generator.next(duration);
  }
  return duration >= maxGeneratorDuration ? Infinity : duration;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/animation/waapi/utils/linear.mjs
var generateLinearEasing = (easing, duration, resolution = 10) => {
  let points = "";
  const numPoints = Math.max(Math.round(duration / resolution), 2);
  for (let i = 0;i < numPoints; i++) {
    points += easing(progress(0, numPoints - 1, i)) + ", ";
  }
  return `linear(${points.substring(0, points.length - 2)})`;
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/clamp.mjs
var clamp = (min, max, v) => {
  if (v > max)
    return max;
  if (v < min)
    return min;
  return v;
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/velocity-per-second.mjs
function velocityPerSecond(velocity, frameDuration) {
  return frameDuration ? velocity * (1000 / frameDuration) : 0;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/generators/utils/velocity.mjs
var velocitySampleDuration = 5;
function calcGeneratorVelocity(resolveValue, t, current) {
  const prevT = Math.max(t - velocitySampleDuration, 0);
  return velocityPerSecond(current - resolveValue(prevT), t - prevT);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/generators/spring/defaults.mjs
var springDefaults = {
  stiffness: 100,
  damping: 10,
  mass: 1,
  velocity: 0,
  duration: 800,
  bounce: 0.3,
  visualDuration: 0.3,
  restSpeed: {
    granular: 0.01,
    default: 2
  },
  restDelta: {
    granular: 0.005,
    default: 0.5
  },
  minDuration: 0.01,
  maxDuration: 10,
  minDamping: 0.05,
  maxDamping: 1
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/generators/spring/find.mjs
var safeMin = 0.001;
function findSpring({ duration = springDefaults.duration, bounce = springDefaults.bounce, velocity = springDefaults.velocity, mass = springDefaults.mass }) {
  let envelope;
  let derivative;
  warning(duration <= secondsToMilliseconds(springDefaults.maxDuration), "Spring duration must be 10 seconds or less");
  let dampingRatio = 1 - bounce;
  dampingRatio = clamp(springDefaults.minDamping, springDefaults.maxDamping, dampingRatio);
  duration = clamp(springDefaults.minDuration, springDefaults.maxDuration, millisecondsToSeconds(duration));
  if (dampingRatio < 1) {
    envelope = (undampedFreq2) => {
      const exponentialDecay = undampedFreq2 * dampingRatio;
      const delta = exponentialDecay * duration;
      const a = exponentialDecay - velocity;
      const b = calcAngularFreq(undampedFreq2, dampingRatio);
      const c = Math.exp(-delta);
      return safeMin - a / b * c;
    };
    derivative = (undampedFreq2) => {
      const exponentialDecay = undampedFreq2 * dampingRatio;
      const delta = exponentialDecay * duration;
      const d = delta * velocity + velocity;
      const e = Math.pow(dampingRatio, 2) * Math.pow(undampedFreq2, 2) * duration;
      const f = Math.exp(-delta);
      const g = calcAngularFreq(Math.pow(undampedFreq2, 2), dampingRatio);
      const factor = -envelope(undampedFreq2) + safeMin > 0 ? -1 : 1;
      return factor * ((d - e) * f) / g;
    };
  } else {
    envelope = (undampedFreq2) => {
      const a = Math.exp(-undampedFreq2 * duration);
      const b = (undampedFreq2 - velocity) * duration + 1;
      return -safeMin + a * b;
    };
    derivative = (undampedFreq2) => {
      const a = Math.exp(-undampedFreq2 * duration);
      const b = (velocity - undampedFreq2) * (duration * duration);
      return a * b;
    };
  }
  const initialGuess = 5 / duration;
  const undampedFreq = approximateRoot(envelope, derivative, initialGuess);
  duration = secondsToMilliseconds(duration);
  if (isNaN(undampedFreq)) {
    return {
      stiffness: springDefaults.stiffness,
      damping: springDefaults.damping,
      duration
    };
  } else {
    const stiffness = Math.pow(undampedFreq, 2) * mass;
    return {
      stiffness,
      damping: dampingRatio * 2 * Math.sqrt(mass * stiffness),
      duration
    };
  }
}
var rootIterations = 12;
function approximateRoot(envelope, derivative, initialGuess) {
  let result = initialGuess;
  for (let i = 1;i < rootIterations; i++) {
    result = result - envelope(result) / derivative(result);
  }
  return result;
}
function calcAngularFreq(undampedFreq, dampingRatio) {
  return undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/generators/spring/index.mjs
var durationKeys = ["duration", "bounce"];
var physicsKeys = ["stiffness", "damping", "mass"];
function isSpringType(options, keys) {
  return keys.some((key) => options[key] !== undefined);
}
function getSpringOptions(options) {
  let springOptions = {
    velocity: springDefaults.velocity,
    stiffness: springDefaults.stiffness,
    damping: springDefaults.damping,
    mass: springDefaults.mass,
    isResolvedFromDuration: false,
    ...options
  };
  if (!isSpringType(options, physicsKeys) && isSpringType(options, durationKeys)) {
    if (options.visualDuration) {
      const visualDuration = options.visualDuration;
      const root = 2 * Math.PI / (visualDuration * 1.2);
      const stiffness = root * root;
      const damping = 2 * clamp(0.05, 1, 1 - (options.bounce || 0)) * Math.sqrt(stiffness);
      springOptions = {
        ...springOptions,
        mass: springDefaults.mass,
        stiffness,
        damping
      };
    } else {
      const derived = findSpring(options);
      springOptions = {
        ...springOptions,
        ...derived,
        mass: springDefaults.mass
      };
      springOptions.isResolvedFromDuration = true;
    }
  }
  return springOptions;
}
function spring(optionsOrVisualDuration = springDefaults.visualDuration, bounce = springDefaults.bounce) {
  const options = typeof optionsOrVisualDuration !== "object" ? {
    visualDuration: optionsOrVisualDuration,
    keyframes: [0, 1],
    bounce
  } : optionsOrVisualDuration;
  let { restSpeed, restDelta } = options;
  const origin = options.keyframes[0];
  const target = options.keyframes[options.keyframes.length - 1];
  const state = { done: false, value: origin };
  const { stiffness, damping, mass, duration, velocity, isResolvedFromDuration } = getSpringOptions({
    ...options,
    velocity: -millisecondsToSeconds(options.velocity || 0)
  });
  const initialVelocity = velocity || 0;
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  const initialDelta = target - origin;
  const undampedAngularFreq = millisecondsToSeconds(Math.sqrt(stiffness / mass));
  const isGranularScale = Math.abs(initialDelta) < 5;
  restSpeed || (restSpeed = isGranularScale ? springDefaults.restSpeed.granular : springDefaults.restSpeed.default);
  restDelta || (restDelta = isGranularScale ? springDefaults.restDelta.granular : springDefaults.restDelta.default);
  let resolveSpring;
  if (dampingRatio < 1) {
    const angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio);
    resolveSpring = (t) => {
      const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
      return target - envelope * ((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) / angularFreq * Math.sin(angularFreq * t) + initialDelta * Math.cos(angularFreq * t));
    };
  } else if (dampingRatio === 1) {
    resolveSpring = (t) => target - Math.exp(-undampedAngularFreq * t) * (initialDelta + (initialVelocity + undampedAngularFreq * initialDelta) * t);
  } else {
    const dampedAngularFreq = undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1);
    resolveSpring = (t) => {
      const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
      const freqForT = Math.min(dampedAngularFreq * t, 300);
      return target - envelope * ((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) * Math.sinh(freqForT) + dampedAngularFreq * initialDelta * Math.cosh(freqForT)) / dampedAngularFreq;
    };
  }
  const generator = {
    calculatedDuration: isResolvedFromDuration ? duration || null : null,
    next: (t) => {
      const current = resolveSpring(t);
      if (!isResolvedFromDuration) {
        let currentVelocity = 0;
        if (dampingRatio < 1) {
          currentVelocity = t === 0 ? secondsToMilliseconds(initialVelocity) : calcGeneratorVelocity(resolveSpring, t, current);
        }
        const isBelowVelocityThreshold = Math.abs(currentVelocity) <= restSpeed;
        const isBelowDisplacementThreshold = Math.abs(target - current) <= restDelta;
        state.done = isBelowVelocityThreshold && isBelowDisplacementThreshold;
      } else {
        state.done = t >= duration;
      }
      state.value = state.done ? target : current;
      return state;
    },
    toString: () => {
      const calculatedDuration = Math.min(calcGeneratorDuration(generator), maxGeneratorDuration);
      const easing = generateLinearEasing((progress2) => generator.next(calculatedDuration * progress2).value, calculatedDuration, 30);
      return calculatedDuration + "ms " + easing;
    }
  };
  return generator;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/animation/generators/utils/create-generator-easing.mjs
function createGeneratorEasing(options, scale = 100, createGenerator) {
  const generator = createGenerator({ ...options, keyframes: [0, scale] });
  const duration = Math.min(calcGeneratorDuration(generator), maxGeneratorDuration);
  return {
    type: "keyframes",
    ease: (progress2) => {
      return generator.next(duration * progress2).value / scale;
    },
    duration: millisecondsToSeconds(duration)
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/animation/generators/utils/is-generator.mjs
function isGenerator(type) {
  return typeof type === "function";
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/wrap.mjs
var wrap = (min, max, v) => {
  const rangeSize = max - min;
  return ((v - min) % rangeSize + rangeSize) % rangeSize + min;
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/easing/utils/is-easing-array.mjs
var isEasingArray = (ease) => {
  return Array.isArray(ease) && typeof ease[0] !== "number";
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/easing/utils/get-easing-for-segment.mjs
function getEasingForSegment(easing, i) {
  return isEasingArray(easing) ? easing[wrap(0, easing.length, i)] : easing;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/mix/number.mjs
var mixNumber = (from, to, progress2) => {
  return from + (to - from) * progress2;
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/offsets/fill.mjs
function fillOffset(offset, remaining) {
  const min = offset[offset.length - 1];
  for (let i = 1;i <= remaining; i++) {
    const offsetProgress = progress(0, remaining, i);
    offset.push(mixNumber(min, 1, offsetProgress));
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/offsets/default.mjs
function defaultOffset(arr) {
  const offset = [0];
  fillOffset(offset, arr.length - 1);
  return offset;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/utils/is-motion-value.mjs
var isMotionValue = (value) => Boolean(value && value.getVelocity);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/utils/resolve-elements.mjs
function resolveElements(elementOrSelector, scope, selectorCache) {
  var _a;
  if (elementOrSelector instanceof Element) {
    return [elementOrSelector];
  } else if (typeof elementOrSelector === "string") {
    let root = document;
    if (scope) {
      root = scope.current;
    }
    const elements = (_a = selectorCache === null || selectorCache === undefined ? undefined : selectorCache[elementOrSelector]) !== null && _a !== undefined ? _a : root.querySelectorAll(elementOrSelector);
    return elements ? Array.from(elements) : [];
  }
  return Array.from(elementOrSelector);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/utils/is-dom-keyframes.mjs
function isDOMKeyframes(keyframes) {
  return typeof keyframes === "object" && !Array.isArray(keyframes);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animate/resolve-subjects.mjs
function resolveSubjects(subject, keyframes, scope, selectorCache) {
  if (typeof subject === "string" && isDOMKeyframes(keyframes)) {
    return resolveElements(subject, scope, selectorCache);
  } else if (subject instanceof NodeList) {
    return Array.from(subject);
  } else if (Array.isArray(subject)) {
    return subject;
  } else {
    return [subject];
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/sequence/utils/calc-repeat-duration.mjs
function calculateRepeatDuration(duration, repeat, _repeatDelay) {
  return duration * (repeat + 1);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/sequence/utils/calc-time.mjs
function calcNextTime(current, next, prev, labels) {
  var _a;
  if (typeof next === "number") {
    return next;
  } else if (next.startsWith("-") || next.startsWith("+")) {
    return Math.max(0, current + parseFloat(next));
  } else if (next === "<") {
    return prev;
  } else {
    return (_a = labels.get(next)) !== null && _a !== undefined ? _a : current;
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/array.mjs
function addUniqueItem(arr, item) {
  if (arr.indexOf(item) === -1)
    arr.push(item);
}
function removeItem(arr, item) {
  const index = arr.indexOf(item);
  if (index > -1)
    arr.splice(index, 1);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/sequence/utils/edit.mjs
function eraseKeyframes(sequence, startTime, endTime) {
  for (let i = 0;i < sequence.length; i++) {
    const keyframe = sequence[i];
    if (keyframe.at > startTime && keyframe.at < endTime) {
      removeItem(sequence, keyframe);
      i--;
    }
  }
}
function addKeyframes(sequence, keyframes, easing, offset, startTime, endTime) {
  eraseKeyframes(sequence, startTime, endTime);
  for (let i = 0;i < keyframes.length; i++) {
    sequence.push({
      value: keyframes[i],
      at: mixNumber(startTime, endTime, offset[i]),
      easing: getEasingForSegment(easing, i)
    });
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/sequence/utils/normalize-times.mjs
function normalizeTimes(times, repeat) {
  for (let i = 0;i < times.length; i++) {
    times[i] = times[i] / (repeat + 1);
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/sequence/utils/sort.mjs
function compareByTime(a, b) {
  if (a.at === b.at) {
    if (a.value === null)
      return 1;
    if (b.value === null)
      return -1;
    return 0;
  } else {
    return a.at - b.at;
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/sequence/create.mjs
var defaultSegmentEasing = "easeInOut";
var MAX_REPEAT = 20;
function createAnimationsFromSequence(sequence, { defaultTransition = {}, ...sequenceTransition } = {}, scope, generators) {
  const defaultDuration = defaultTransition.duration || 0.3;
  const animationDefinitions = new Map;
  const sequences = new Map;
  const elementCache = {};
  const timeLabels = new Map;
  let prevTime = 0;
  let currentTime = 0;
  let totalDuration = 0;
  for (let i = 0;i < sequence.length; i++) {
    const segment = sequence[i];
    if (typeof segment === "string") {
      timeLabels.set(segment, currentTime);
      continue;
    } else if (!Array.isArray(segment)) {
      timeLabels.set(segment.name, calcNextTime(currentTime, segment.at, prevTime, timeLabels));
      continue;
    }
    let [subject, keyframes, transition = {}] = segment;
    if (transition.at !== undefined) {
      currentTime = calcNextTime(currentTime, transition.at, prevTime, timeLabels);
    }
    let maxDuration = 0;
    const resolveValueSequence = (valueKeyframes, valueTransition, valueSequence, elementIndex = 0, numSubjects = 0) => {
      const valueKeyframesAsList = keyframesAsList(valueKeyframes);
      const { delay = 0, times = defaultOffset(valueKeyframesAsList), type = "keyframes", repeat, repeatType, repeatDelay = 0, ...remainingTransition } = valueTransition;
      let { ease = defaultTransition.ease || "easeOut", duration } = valueTransition;
      const calculatedDelay = typeof delay === "function" ? delay(elementIndex, numSubjects) : delay;
      const numKeyframes = valueKeyframesAsList.length;
      const createGenerator = isGenerator(type) ? type : generators === null || generators === undefined ? undefined : generators[type];
      if (numKeyframes <= 2 && createGenerator) {
        let absoluteDelta = 100;
        if (numKeyframes === 2 && isNumberKeyframesArray(valueKeyframesAsList)) {
          const delta = valueKeyframesAsList[1] - valueKeyframesAsList[0];
          absoluteDelta = Math.abs(delta);
        }
        const springTransition = { ...remainingTransition };
        if (duration !== undefined) {
          springTransition.duration = secondsToMilliseconds(duration);
        }
        const springEasing = createGeneratorEasing(springTransition, absoluteDelta, createGenerator);
        ease = springEasing.ease;
        duration = springEasing.duration;
      }
      duration !== null && duration !== undefined || (duration = defaultDuration);
      const startTime = currentTime + calculatedDelay;
      if (times.length === 1 && times[0] === 0) {
        times[1] = 1;
      }
      const remainder = times.length - valueKeyframesAsList.length;
      remainder > 0 && fillOffset(times, remainder);
      valueKeyframesAsList.length === 1 && valueKeyframesAsList.unshift(null);
      if (repeat) {
        invariant(repeat < MAX_REPEAT, "Repeat count too high, must be less than 20");
        duration = calculateRepeatDuration(duration, repeat);
        const originalKeyframes = [...valueKeyframesAsList];
        const originalTimes = [...times];
        ease = Array.isArray(ease) ? [...ease] : [ease];
        const originalEase = [...ease];
        for (let repeatIndex = 0;repeatIndex < repeat; repeatIndex++) {
          valueKeyframesAsList.push(...originalKeyframes);
          for (let keyframeIndex = 0;keyframeIndex < originalKeyframes.length; keyframeIndex++) {
            times.push(originalTimes[keyframeIndex] + (repeatIndex + 1));
            ease.push(keyframeIndex === 0 ? "linear" : getEasingForSegment(originalEase, keyframeIndex - 1));
          }
        }
        normalizeTimes(times, repeat);
      }
      const targetTime = startTime + duration;
      addKeyframes(valueSequence, valueKeyframesAsList, ease, times, startTime, targetTime);
      maxDuration = Math.max(calculatedDelay + duration, maxDuration);
      totalDuration = Math.max(targetTime, totalDuration);
    };
    if (isMotionValue(subject)) {
      const subjectSequence = getSubjectSequence(subject, sequences);
      resolveValueSequence(keyframes, transition, getValueSequence("default", subjectSequence));
    } else {
      const subjects = resolveSubjects(subject, keyframes, scope, elementCache);
      const numSubjects = subjects.length;
      for (let subjectIndex = 0;subjectIndex < numSubjects; subjectIndex++) {
        keyframes = keyframes;
        transition = transition;
        const thisSubject = subjects[subjectIndex];
        const subjectSequence = getSubjectSequence(thisSubject, sequences);
        for (const key in keyframes) {
          resolveValueSequence(keyframes[key], getValueTransition(transition, key), getValueSequence(key, subjectSequence), subjectIndex, numSubjects);
        }
      }
    }
    prevTime = currentTime;
    currentTime += maxDuration;
  }
  sequences.forEach((valueSequences, element) => {
    for (const key in valueSequences) {
      const valueSequence = valueSequences[key];
      valueSequence.sort(compareByTime);
      const keyframes = [];
      const valueOffset = [];
      const valueEasing = [];
      for (let i = 0;i < valueSequence.length; i++) {
        const { at, value, easing } = valueSequence[i];
        keyframes.push(value);
        valueOffset.push(progress(0, totalDuration, at));
        valueEasing.push(easing || "easeOut");
      }
      if (valueOffset[0] !== 0) {
        valueOffset.unshift(0);
        keyframes.unshift(keyframes[0]);
        valueEasing.unshift(defaultSegmentEasing);
      }
      if (valueOffset[valueOffset.length - 1] !== 1) {
        valueOffset.push(1);
        keyframes.push(null);
      }
      if (!animationDefinitions.has(element)) {
        animationDefinitions.set(element, {
          keyframes: {},
          transition: {}
        });
      }
      const definition = animationDefinitions.get(element);
      definition.keyframes[key] = keyframes;
      definition.transition[key] = {
        ...defaultTransition,
        duration: totalDuration,
        ease: valueEasing,
        times: valueOffset,
        ...sequenceTransition
      };
    }
  });
  return animationDefinitions;
}
function getSubjectSequence(subject, sequences) {
  !sequences.has(subject) && sequences.set(subject, {});
  return sequences.get(subject);
}
function getValueSequence(name, sequences) {
  if (!sequences[name])
    sequences[name] = [];
  return sequences[name];
}
function keyframesAsList(keyframes) {
  return Array.isArray(keyframes) ? keyframes : [keyframes];
}
function getValueTransition(transition, key) {
  return transition && transition[key] ? {
    ...transition,
    ...transition[key]
  } : { ...transition };
}
var isNumber = (keyframe) => typeof keyframe === "number";
var isNumberKeyframesArray = (keyframes) => keyframes.every(isNumber);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/store.mjs
var visualElementStore = new WeakMap;

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/animation/utils/get-value-transition.mjs
function getValueTransition2(transition, key) {
  return transition ? transition[key] || transition["default"] || transition : undefined;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/html/utils/keys-transform.mjs
var transformPropOrder = [
  "transformPerspective",
  "x",
  "y",
  "z",
  "translateX",
  "translateY",
  "translateZ",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skew",
  "skewX",
  "skewY"
];
var transformProps = new Set(transformPropOrder);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/html/utils/keys-position.mjs
var positionalKeys = new Set([
  "width",
  "height",
  "top",
  "left",
  "right",
  "bottom",
  ...transformPropOrder
]);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/utils/is-keyframes-target.mjs
var isKeyframesTarget = (v) => {
  return Array.isArray(v);
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/resolve-value.mjs
var resolveFinalValueInKeyframes = (v) => {
  return isKeyframesTarget(v) ? v[v.length - 1] || 0 : v;
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/GlobalConfig.mjs
var MotionGlobalConfig = {
  skipAnimations: false,
  useManualTiming: false
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/frameloop/render-step.mjs
function createRenderStep(runNextFrame) {
  let thisFrame = new Set;
  let nextFrame = new Set;
  let isProcessing = false;
  let flushNextFrame = false;
  const toKeepAlive = new WeakSet;
  let latestFrameData = {
    delta: 0,
    timestamp: 0,
    isProcessing: false
  };
  function triggerCallback(callback) {
    if (toKeepAlive.has(callback)) {
      step.schedule(callback);
      runNextFrame();
    }
    callback(latestFrameData);
  }
  const step = {
    schedule: (callback, keepAlive = false, immediate = false) => {
      const addToCurrentFrame = immediate && isProcessing;
      const queue = addToCurrentFrame ? thisFrame : nextFrame;
      if (keepAlive)
        toKeepAlive.add(callback);
      if (!queue.has(callback))
        queue.add(callback);
      return callback;
    },
    cancel: (callback) => {
      nextFrame.delete(callback);
      toKeepAlive.delete(callback);
    },
    process: (frameData) => {
      latestFrameData = frameData;
      if (isProcessing) {
        flushNextFrame = true;
        return;
      }
      isProcessing = true;
      [thisFrame, nextFrame] = [nextFrame, thisFrame];
      thisFrame.forEach(triggerCallback);
      thisFrame.clear();
      isProcessing = false;
      if (flushNextFrame) {
        flushNextFrame = false;
        step.process(frameData);
      }
    }
  };
  return step;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/frameloop/batcher.mjs
var stepsOrder = [
  "read",
  "resolveKeyframes",
  "update",
  "preRender",
  "render",
  "postRender"
];
var maxElapsed = 40;
function createRenderBatcher(scheduleNextBatch, allowKeepAlive) {
  let runNextFrame = false;
  let useDefaultElapsed = true;
  const state = {
    delta: 0,
    timestamp: 0,
    isProcessing: false
  };
  const flagRunNextFrame = () => runNextFrame = true;
  const steps = stepsOrder.reduce((acc, key) => {
    acc[key] = createRenderStep(flagRunNextFrame);
    return acc;
  }, {});
  const { read, resolveKeyframes, update, preRender, render, postRender } = steps;
  const processBatch = () => {
    const timestamp = MotionGlobalConfig.useManualTiming ? state.timestamp : performance.now();
    runNextFrame = false;
    state.delta = useDefaultElapsed ? 1000 / 60 : Math.max(Math.min(timestamp - state.timestamp, maxElapsed), 1);
    state.timestamp = timestamp;
    state.isProcessing = true;
    read.process(state);
    resolveKeyframes.process(state);
    update.process(state);
    preRender.process(state);
    render.process(state);
    postRender.process(state);
    state.isProcessing = false;
    if (runNextFrame && allowKeepAlive) {
      useDefaultElapsed = false;
      scheduleNextBatch(processBatch);
    }
  };
  const wake = () => {
    runNextFrame = true;
    useDefaultElapsed = true;
    if (!state.isProcessing) {
      scheduleNextBatch(processBatch);
    }
  };
  const schedule = stepsOrder.reduce((acc, key) => {
    const step = steps[key];
    acc[key] = (process, keepAlive = false, immediate = false) => {
      if (!runNextFrame)
        wake();
      return step.schedule(process, keepAlive, immediate);
    };
    return acc;
  }, {});
  const cancel = (process) => {
    for (let i = 0;i < stepsOrder.length; i++) {
      steps[stepsOrder[i]].cancel(process);
    }
  };
  return { schedule, cancel, state, steps };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/frameloop/frame.mjs
var { schedule: frame, cancel: cancelFrame, state: frameData, steps: frameSteps } = createRenderBatcher(typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : noop, true);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/frameloop/sync-time.mjs
var now;
function clearTime() {
  now = undefined;
}
var time = {
  now: () => {
    if (now === undefined) {
      time.set(frameData.isProcessing || MotionGlobalConfig.useManualTiming ? frameData.timestamp : performance.now());
    }
    return now;
  },
  set: (newTime) => {
    now = newTime;
    queueMicrotask(clearTime);
  }
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/subscription-manager.mjs
class SubscriptionManager {
  constructor() {
    this.subscriptions = [];
  }
  add(handler) {
    addUniqueItem(this.subscriptions, handler);
    return () => removeItem(this.subscriptions, handler);
  }
  notify(a, b, c) {
    const numSubscriptions = this.subscriptions.length;
    if (!numSubscriptions)
      return;
    if (numSubscriptions === 1) {
      this.subscriptions[0](a, b, c);
    } else {
      for (let i = 0;i < numSubscriptions; i++) {
        const handler = this.subscriptions[i];
        handler && handler(a, b, c);
      }
    }
  }
  getSize() {
    return this.subscriptions.length;
  }
  clear() {
    this.subscriptions.length = 0;
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/warn-once.mjs
var warned = new Set;

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/index.mjs
var MAX_VELOCITY_DELTA = 30;
var isFloat = (value) => {
  return !isNaN(parseFloat(value));
};
var collectMotionValues = {
  current: undefined
};

class MotionValue {
  constructor(init, options = {}) {
    this.version = "11.18.2";
    this.canTrackVelocity = null;
    this.events = {};
    this.updateAndNotify = (v, render = true) => {
      const currentTime = time.now();
      if (this.updatedAt !== currentTime) {
        this.setPrevFrameValue();
      }
      this.prev = this.current;
      this.setCurrent(v);
      if (this.current !== this.prev && this.events.change) {
        this.events.change.notify(this.current);
      }
      if (render && this.events.renderRequest) {
        this.events.renderRequest.notify(this.current);
      }
    };
    this.hasAnimated = false;
    this.setCurrent(init);
    this.owner = options.owner;
  }
  setCurrent(current) {
    this.current = current;
    this.updatedAt = time.now();
    if (this.canTrackVelocity === null && current !== undefined) {
      this.canTrackVelocity = isFloat(this.current);
    }
  }
  setPrevFrameValue(prevFrameValue = this.current) {
    this.prevFrameValue = prevFrameValue;
    this.prevUpdatedAt = this.updatedAt;
  }
  onChange(subscription) {
    if (false) {}
    return this.on("change", subscription);
  }
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = new SubscriptionManager;
    }
    const unsubscribe = this.events[eventName].add(callback);
    if (eventName === "change") {
      return () => {
        unsubscribe();
        frame.read(() => {
          if (!this.events.change.getSize()) {
            this.stop();
          }
        });
      };
    }
    return unsubscribe;
  }
  clearListeners() {
    for (const eventManagers in this.events) {
      this.events[eventManagers].clear();
    }
  }
  attach(passiveEffect, stopPassiveEffect) {
    this.passiveEffect = passiveEffect;
    this.stopPassiveEffect = stopPassiveEffect;
  }
  set(v, render = true) {
    if (!render || !this.passiveEffect) {
      this.updateAndNotify(v, render);
    } else {
      this.passiveEffect(v, this.updateAndNotify);
    }
  }
  setWithVelocity(prev, current, delta) {
    this.set(current);
    this.prev = undefined;
    this.prevFrameValue = prev;
    this.prevUpdatedAt = this.updatedAt - delta;
  }
  jump(v, endAnimation = true) {
    this.updateAndNotify(v);
    this.prev = v;
    this.prevUpdatedAt = this.prevFrameValue = undefined;
    endAnimation && this.stop();
    if (this.stopPassiveEffect)
      this.stopPassiveEffect();
  }
  get() {
    if (collectMotionValues.current) {
      collectMotionValues.current.push(this);
    }
    return this.current;
  }
  getPrevious() {
    return this.prev;
  }
  getVelocity() {
    const currentTime = time.now();
    if (!this.canTrackVelocity || this.prevFrameValue === undefined || currentTime - this.updatedAt > MAX_VELOCITY_DELTA) {
      return 0;
    }
    const delta = Math.min(this.updatedAt - this.prevUpdatedAt, MAX_VELOCITY_DELTA);
    return velocityPerSecond(parseFloat(this.current) - parseFloat(this.prevFrameValue), delta);
  }
  start(startAnimation) {
    this.stop();
    return new Promise((resolve) => {
      this.hasAnimated = true;
      this.animation = startAnimation(resolve);
      if (this.events.animationStart) {
        this.events.animationStart.notify();
      }
    }).then(() => {
      if (this.events.animationComplete) {
        this.events.animationComplete.notify();
      }
      this.clearAnimation();
    });
  }
  stop() {
    if (this.animation) {
      this.animation.stop();
      if (this.events.animationCancel) {
        this.events.animationCancel.notify();
      }
    }
    this.clearAnimation();
  }
  isAnimating() {
    return !!this.animation;
  }
  clearAnimation() {
    delete this.animation;
  }
  destroy() {
    this.clearListeners();
    this.stop();
    if (this.stopPassiveEffect) {
      this.stopPassiveEffect();
    }
  }
}
function motionValue(init, options) {
  return new MotionValue(init, options);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/utils/resolve-variants.mjs
function getValueState(visualElement) {
  const state = [{}, {}];
  visualElement === null || visualElement === undefined || visualElement.values.forEach((value, key) => {
    state[0][key] = value.get();
    state[1][key] = value.getVelocity();
  });
  return state;
}
function resolveVariantFromProps(props, definition, custom, visualElement) {
  if (typeof definition === "function") {
    const [current, velocity] = getValueState(visualElement);
    definition = definition(custom !== undefined ? custom : props.custom, current, velocity);
  }
  if (typeof definition === "string") {
    definition = props.variants && props.variants[definition];
  }
  if (typeof definition === "function") {
    const [current, velocity] = getValueState(visualElement);
    definition = definition(custom !== undefined ? custom : props.custom, current, velocity);
  }
  return definition;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/utils/resolve-dynamic-variants.mjs
function resolveVariant(visualElement, definition, custom) {
  const props = visualElement.getProps();
  return resolveVariantFromProps(props, definition, custom !== undefined ? custom : props.custom, visualElement);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/utils/setters.mjs
function setMotionValue(visualElement, key, value) {
  if (visualElement.hasValue(key)) {
    visualElement.getValue(key).set(value);
  } else {
    visualElement.addValue(key, motionValue(value));
  }
}
function setTarget(visualElement, definition) {
  const resolved = resolveVariant(visualElement, definition);
  let { transitionEnd = {}, transition = {}, ...target } = resolved || {};
  target = { ...target, ...transitionEnd };
  for (const key in target) {
    const value = resolveFinalValueInKeyframes(target[key]);
    setMotionValue(visualElement, key, value);
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/use-will-change/is.mjs
function isWillChangeMotionValue(value) {
  return Boolean(isMotionValue(value) && value.add);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/use-will-change/add-will-change.mjs
function addValueToWillChange(visualElement, key) {
  const willChange = visualElement.getValue("willChange");
  if (isWillChangeMotionValue(willChange)) {
    return willChange.add(key);
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/utils/camel-to-dash.mjs
var camelToDash = (str) => str.replace(/([a-z])([A-Z])/gu, "$1-$2").toLowerCase();

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/optimized-appear/data-id.mjs
var optimizedAppearDataId = "framerAppearId";
var optimizedAppearDataAttribute = "data-" + camelToDash(optimizedAppearDataId);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/optimized-appear/get-appear-id.mjs
function getOptimisedAppearId(visualElement) {
  return visualElement.props[optimizedAppearDataAttribute];
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/use-instant-transition-state.mjs
var instantAnimationState = {
  current: false
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/animation/waapi/utils/attach-timeline.mjs
function attachTimeline(animation, timeline) {
  animation.timeline = timeline;
  animation.onfinish = null;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/utils/is-bezier-definition.mjs
var isBezierDefinition = (easing) => Array.isArray(easing) && typeof easing[0] === "number";

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/utils/supports/flags.mjs
var supportsFlags = {
  linearEasing: undefined
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/utils/supports/memo.mjs
function memoSupports(callback, supportsFlag) {
  const memoized = memo(callback);
  return () => {
    var _a;
    return (_a = supportsFlags[supportsFlag]) !== null && _a !== undefined ? _a : memoized();
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/utils/supports/linear-easing.mjs
var supportsLinearEasing = /* @__PURE__ */ memoSupports(() => {
  try {
    document.createElement("div").animate({ opacity: 0 }, { easing: "linear(0, 1)" });
  } catch (e) {
    return false;
  }
  return true;
}, "linearEasing");

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/animation/waapi/utils/easing.mjs
function isWaapiSupportedEasing(easing) {
  return Boolean(typeof easing === "function" && supportsLinearEasing() || !easing || typeof easing === "string" && ((easing in supportedWaapiEasing) || supportsLinearEasing()) || isBezierDefinition(easing) || Array.isArray(easing) && easing.every(isWaapiSupportedEasing));
}
var cubicBezierAsString = ([a, b, c, d]) => `cubic-bezier(${a}, ${b}, ${c}, ${d})`;
var supportedWaapiEasing = {
  linear: "linear",
  ease: "ease",
  easeIn: "ease-in",
  easeOut: "ease-out",
  easeInOut: "ease-in-out",
  circIn: /* @__PURE__ */ cubicBezierAsString([0, 0.65, 0.55, 1]),
  circOut: /* @__PURE__ */ cubicBezierAsString([0.55, 0, 1, 0.45]),
  backIn: /* @__PURE__ */ cubicBezierAsString([0.31, 0.01, 0.66, -0.59]),
  backOut: /* @__PURE__ */ cubicBezierAsString([0.33, 1.53, 0.69, 0.99])
};
function mapEasingToNativeEasing(easing, duration) {
  if (!easing) {
    return;
  } else if (typeof easing === "function" && supportsLinearEasing()) {
    return generateLinearEasing(easing, duration);
  } else if (isBezierDefinition(easing)) {
    return cubicBezierAsString(easing);
  } else if (Array.isArray(easing)) {
    return easing.map((segmentEasing) => mapEasingToNativeEasing(segmentEasing, duration) || supportedWaapiEasing.easeOut);
  } else {
    return supportedWaapiEasing[easing];
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/easing/cubic-bezier.mjs
var calcBezier = (t, a1, a2) => (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + 3 * a1) * t;
var subdivisionPrecision = 0.0000001;
var subdivisionMaxIterations = 12;
function binarySubdivide(x, lowerBound, upperBound, mX1, mX2) {
  let currentX;
  let currentT;
  let i = 0;
  do {
    currentT = lowerBound + (upperBound - lowerBound) / 2;
    currentX = calcBezier(currentT, mX1, mX2) - x;
    if (currentX > 0) {
      upperBound = currentT;
    } else {
      lowerBound = currentT;
    }
  } while (Math.abs(currentX) > subdivisionPrecision && ++i < subdivisionMaxIterations);
  return currentT;
}
function cubicBezier(mX1, mY1, mX2, mY2) {
  if (mX1 === mY1 && mX2 === mY2)
    return noop;
  const getTForX = (aX) => binarySubdivide(aX, 0, 1, mX1, mX2);
  return (t) => t === 0 || t === 1 ? t : calcBezier(getTForX(t), mY1, mY2);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/easing/modifiers/mirror.mjs
var mirrorEasing = (easing) => (p) => p <= 0.5 ? easing(2 * p) / 2 : (2 - easing(2 * (1 - p))) / 2;

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/easing/modifiers/reverse.mjs
var reverseEasing = (easing) => (p) => 1 - easing(1 - p);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/easing/back.mjs
var backOut = /* @__PURE__ */ cubicBezier(0.33, 1.53, 0.69, 0.99);
var backIn = /* @__PURE__ */ reverseEasing(backOut);
var backInOut = /* @__PURE__ */ mirrorEasing(backIn);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/easing/anticipate.mjs
var anticipate = (p) => (p *= 2) < 1 ? 0.5 * backIn(p) : 0.5 * (2 - Math.pow(2, -10 * (p - 1)));

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/easing/circ.mjs
var circIn = (p) => 1 - Math.sin(Math.acos(p));
var circOut = reverseEasing(circIn);
var circInOut = mirrorEasing(circIn);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/is-zero-value-string.mjs
var isZeroValueString = (v) => /^0[^.\s]+$/u.test(v);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/utils/is-none.mjs
function isNone(value) {
  if (typeof value === "number") {
    return value === 0;
  } else if (value !== null) {
    return value === "none" || value === "0" || isZeroValueString(value);
  } else {
    return true;
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/numbers/index.mjs
var number = {
  test: (v) => typeof v === "number",
  parse: parseFloat,
  transform: (v) => v
};
var alpha = {
  ...number,
  transform: (v) => clamp(0, 1, v)
};
var scale = {
  ...number,
  default: 1
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/utils/sanitize.mjs
var sanitize = (v) => Math.round(v * 1e5) / 1e5;

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/utils/float-regex.mjs
var floatRegex = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/utils/is-nullish.mjs
function isNullish(v) {
  return v == null;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/utils/single-color-regex.mjs
var singleColorRegex = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu;

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/color/utils.mjs
var isColorString = (type, testProp) => (v) => {
  return Boolean(typeof v === "string" && singleColorRegex.test(v) && v.startsWith(type) || testProp && !isNullish(v) && Object.prototype.hasOwnProperty.call(v, testProp));
};
var splitColor = (aName, bName, cName) => (v) => {
  if (typeof v !== "string")
    return v;
  const [a, b, c, alpha2] = v.match(floatRegex);
  return {
    [aName]: parseFloat(a),
    [bName]: parseFloat(b),
    [cName]: parseFloat(c),
    alpha: alpha2 !== undefined ? parseFloat(alpha2) : 1
  };
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/color/rgba.mjs
var clampRgbUnit = (v) => clamp(0, 255, v);
var rgbUnit = {
  ...number,
  transform: (v) => Math.round(clampRgbUnit(v))
};
var rgba = {
  test: /* @__PURE__ */ isColorString("rgb", "red"),
  parse: /* @__PURE__ */ splitColor("red", "green", "blue"),
  transform: ({ red, green, blue, alpha: alpha$1 = 1 }) => "rgba(" + rgbUnit.transform(red) + ", " + rgbUnit.transform(green) + ", " + rgbUnit.transform(blue) + ", " + sanitize(alpha.transform(alpha$1)) + ")"
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/color/hex.mjs
function parseHex(v) {
  let r = "";
  let g = "";
  let b = "";
  let a = "";
  if (v.length > 5) {
    r = v.substring(1, 3);
    g = v.substring(3, 5);
    b = v.substring(5, 7);
    a = v.substring(7, 9);
  } else {
    r = v.substring(1, 2);
    g = v.substring(2, 3);
    b = v.substring(3, 4);
    a = v.substring(4, 5);
    r += r;
    g += g;
    b += b;
    a += a;
  }
  return {
    red: parseInt(r, 16),
    green: parseInt(g, 16),
    blue: parseInt(b, 16),
    alpha: a ? parseInt(a, 16) / 255 : 1
  };
}
var hex = {
  test: /* @__PURE__ */ isColorString("#"),
  parse: parseHex,
  transform: rgba.transform
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/numbers/units.mjs
var createUnitType = (unit) => ({
  test: (v) => typeof v === "string" && v.endsWith(unit) && v.split(" ").length === 1,
  parse: parseFloat,
  transform: (v) => `${v}${unit}`
});
var degrees = /* @__PURE__ */ createUnitType("deg");
var percent = /* @__PURE__ */ createUnitType("%");
var px = /* @__PURE__ */ createUnitType("px");
var vh = /* @__PURE__ */ createUnitType("vh");
var vw = /* @__PURE__ */ createUnitType("vw");
var progressPercentage = {
  ...percent,
  parse: (v) => percent.parse(v) / 100,
  transform: (v) => percent.transform(v * 100)
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/color/hsla.mjs
var hsla = {
  test: /* @__PURE__ */ isColorString("hsl", "hue"),
  parse: /* @__PURE__ */ splitColor("hue", "saturation", "lightness"),
  transform: ({ hue, saturation, lightness, alpha: alpha$1 = 1 }) => {
    return "hsla(" + Math.round(hue) + ", " + percent.transform(sanitize(saturation)) + ", " + percent.transform(sanitize(lightness)) + ", " + sanitize(alpha.transform(alpha$1)) + ")";
  }
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/color/index.mjs
var color = {
  test: (v) => rgba.test(v) || hex.test(v) || hsla.test(v),
  parse: (v) => {
    if (rgba.test(v)) {
      return rgba.parse(v);
    } else if (hsla.test(v)) {
      return hsla.parse(v);
    } else {
      return hex.parse(v);
    }
  },
  transform: (v) => {
    return typeof v === "string" ? v : v.hasOwnProperty("red") ? rgba.transform(v) : hsla.transform(v);
  }
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/utils/color-regex.mjs
var colorRegex = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/complex/index.mjs
function test(v) {
  var _a, _b;
  return isNaN(v) && typeof v === "string" && (((_a = v.match(floatRegex)) === null || _a === undefined ? undefined : _a.length) || 0) + (((_b = v.match(colorRegex)) === null || _b === undefined ? undefined : _b.length) || 0) > 0;
}
var NUMBER_TOKEN = "number";
var COLOR_TOKEN = "color";
var VAR_TOKEN = "var";
var VAR_FUNCTION_TOKEN = "var(";
var SPLIT_TOKEN = "${}";
var complexRegex = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
function analyseComplexValue(value) {
  const originalValue = value.toString();
  const values = [];
  const indexes = {
    color: [],
    number: [],
    var: []
  };
  const types = [];
  let i = 0;
  const tokenised = originalValue.replace(complexRegex, (parsedValue) => {
    if (color.test(parsedValue)) {
      indexes.color.push(i);
      types.push(COLOR_TOKEN);
      values.push(color.parse(parsedValue));
    } else if (parsedValue.startsWith(VAR_FUNCTION_TOKEN)) {
      indexes.var.push(i);
      types.push(VAR_TOKEN);
      values.push(parsedValue);
    } else {
      indexes.number.push(i);
      types.push(NUMBER_TOKEN);
      values.push(parseFloat(parsedValue));
    }
    ++i;
    return SPLIT_TOKEN;
  });
  const split = tokenised.split(SPLIT_TOKEN);
  return { values, split, indexes, types };
}
function parseComplexValue(v) {
  return analyseComplexValue(v).values;
}
function createTransformer(source) {
  const { split, types } = analyseComplexValue(source);
  const numSections = split.length;
  return (v) => {
    let output = "";
    for (let i = 0;i < numSections; i++) {
      output += split[i];
      if (v[i] !== undefined) {
        const type = types[i];
        if (type === NUMBER_TOKEN) {
          output += sanitize(v[i]);
        } else if (type === COLOR_TOKEN) {
          output += color.transform(v[i]);
        } else {
          output += v[i];
        }
      }
    }
    return output;
  };
}
var convertNumbersToZero = (v) => typeof v === "number" ? 0 : v;
function getAnimatableNone(v) {
  const parsed = parseComplexValue(v);
  const transformer = createTransformer(v);
  return transformer(parsed.map(convertNumbersToZero));
}
var complex = {
  test,
  parse: parseComplexValue,
  createTransformer,
  getAnimatableNone
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/value/types/complex/filter.mjs
var maxDefaults = new Set(["brightness", "contrast", "saturate", "opacity"]);
function applyDefaultFilter(v) {
  const [name, value] = v.slice(0, -1).split("(");
  if (name === "drop-shadow")
    return v;
  const [number2] = value.match(floatRegex) || [];
  if (!number2)
    return v;
  const unit = value.replace(number2, "");
  let defaultValue = maxDefaults.has(name) ? 1 : 0;
  if (number2 !== value)
    defaultValue *= 100;
  return name + "(" + defaultValue + unit + ")";
}
var functionRegex = /\b([a-z-]*)\(.*?\)/gu;
var filter = {
  ...complex,
  getAnimatableNone: (v) => {
    const functions = v.match(functionRegex);
    return functions ? functions.map(applyDefaultFilter).join(" ") : v;
  }
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/value-types/number-browser.mjs
var browserNumberValueTypes = {
  borderWidth: px,
  borderTopWidth: px,
  borderRightWidth: px,
  borderBottomWidth: px,
  borderLeftWidth: px,
  borderRadius: px,
  radius: px,
  borderTopLeftRadius: px,
  borderTopRightRadius: px,
  borderBottomRightRadius: px,
  borderBottomLeftRadius: px,
  width: px,
  maxWidth: px,
  height: px,
  maxHeight: px,
  top: px,
  right: px,
  bottom: px,
  left: px,
  padding: px,
  paddingTop: px,
  paddingRight: px,
  paddingBottom: px,
  paddingLeft: px,
  margin: px,
  marginTop: px,
  marginRight: px,
  marginBottom: px,
  marginLeft: px,
  backgroundPositionX: px,
  backgroundPositionY: px
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/value-types/transform.mjs
var transformValueTypes = {
  rotate: degrees,
  rotateX: degrees,
  rotateY: degrees,
  rotateZ: degrees,
  scale,
  scaleX: scale,
  scaleY: scale,
  scaleZ: scale,
  skew: degrees,
  skewX: degrees,
  skewY: degrees,
  distance: px,
  translateX: px,
  translateY: px,
  translateZ: px,
  x: px,
  y: px,
  z: px,
  perspective: px,
  transformPerspective: px,
  opacity: alpha,
  originX: progressPercentage,
  originY: progressPercentage,
  originZ: px
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/value-types/type-int.mjs
var int = {
  ...number,
  transform: Math.round
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/value-types/number.mjs
var numberValueTypes = {
  ...browserNumberValueTypes,
  ...transformValueTypes,
  zIndex: int,
  size: px,
  fillOpacity: alpha,
  strokeOpacity: alpha,
  numOctaves: int
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/value-types/defaults.mjs
var defaultValueTypes = {
  ...numberValueTypes,
  color,
  backgroundColor: color,
  outlineColor: color,
  fill: color,
  stroke: color,
  borderColor: color,
  borderTopColor: color,
  borderRightColor: color,
  borderBottomColor: color,
  borderLeftColor: color,
  filter,
  WebkitFilter: filter
};
var getDefaultValueType = (key) => defaultValueTypes[key];

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/value-types/animatable-none.mjs
function getAnimatableNone2(key, value) {
  let defaultValueType = getDefaultValueType(key);
  if (defaultValueType !== filter)
    defaultValueType = complex;
  return defaultValueType.getAnimatableNone ? defaultValueType.getAnimatableNone(value) : undefined;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/html/utils/make-none-animatable.mjs
var invalidTemplates = new Set(["auto", "none", "0"]);
function makeNoneKeyframesAnimatable(unresolvedKeyframes, noneKeyframeIndexes, name) {
  let i = 0;
  let animatableTemplate = undefined;
  while (i < unresolvedKeyframes.length && !animatableTemplate) {
    const keyframe = unresolvedKeyframes[i];
    if (typeof keyframe === "string" && !invalidTemplates.has(keyframe) && analyseComplexValue(keyframe).values.length) {
      animatableTemplate = unresolvedKeyframes[i];
    }
    i++;
  }
  if (animatableTemplate && name) {
    for (const noneIndex of noneKeyframeIndexes) {
      unresolvedKeyframes[noneIndex] = getAnimatableNone2(name, animatableTemplate);
    }
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/utils/unit-conversion.mjs
var isNumOrPxType = (v) => v === number || v === px;
var getPosFromMatrix = (matrix, pos) => parseFloat(matrix.split(", ")[pos]);
var getTranslateFromMatrix = (pos2, pos3) => (_bbox, { transform }) => {
  if (transform === "none" || !transform)
    return 0;
  const matrix3d = transform.match(/^matrix3d\((.+)\)$/u);
  if (matrix3d) {
    return getPosFromMatrix(matrix3d[1], pos3);
  } else {
    const matrix = transform.match(/^matrix\((.+)\)$/u);
    if (matrix) {
      return getPosFromMatrix(matrix[1], pos2);
    } else {
      return 0;
    }
  }
};
var transformKeys = new Set(["x", "y", "z"]);
var nonTranslationalTransformKeys = transformPropOrder.filter((key) => !transformKeys.has(key));
function removeNonTranslationalTransform(visualElement) {
  const removedTransforms = [];
  nonTranslationalTransformKeys.forEach((key) => {
    const value = visualElement.getValue(key);
    if (value !== undefined) {
      removedTransforms.push([key, value.get()]);
      value.set(key.startsWith("scale") ? 1 : 0);
    }
  });
  return removedTransforms;
}
var positionalValues = {
  width: ({ x }, { paddingLeft = "0", paddingRight = "0" }) => x.max - x.min - parseFloat(paddingLeft) - parseFloat(paddingRight),
  height: ({ y }, { paddingTop = "0", paddingBottom = "0" }) => y.max - y.min - parseFloat(paddingTop) - parseFloat(paddingBottom),
  top: (_bbox, { top }) => parseFloat(top),
  left: (_bbox, { left }) => parseFloat(left),
  bottom: ({ y }, { top }) => parseFloat(top) + (y.max - y.min),
  right: ({ x }, { left }) => parseFloat(left) + (x.max - x.min),
  x: getTranslateFromMatrix(4, 13),
  y: getTranslateFromMatrix(5, 14)
};
positionalValues.translateX = positionalValues.x;
positionalValues.translateY = positionalValues.y;

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/utils/KeyframesResolver.mjs
var toResolve = new Set;
var isScheduled = false;
var anyNeedsMeasurement = false;
function measureAllKeyframes() {
  if (anyNeedsMeasurement) {
    const resolversToMeasure = Array.from(toResolve).filter((resolver) => resolver.needsMeasurement);
    const elementsToMeasure = new Set(resolversToMeasure.map((resolver) => resolver.element));
    const transformsToRestore = new Map;
    elementsToMeasure.forEach((element) => {
      const removedTransforms = removeNonTranslationalTransform(element);
      if (!removedTransforms.length)
        return;
      transformsToRestore.set(element, removedTransforms);
      element.render();
    });
    resolversToMeasure.forEach((resolver) => resolver.measureInitialState());
    elementsToMeasure.forEach((element) => {
      element.render();
      const restore = transformsToRestore.get(element);
      if (restore) {
        restore.forEach(([key, value]) => {
          var _a;
          (_a = element.getValue(key)) === null || _a === undefined || _a.set(value);
        });
      }
    });
    resolversToMeasure.forEach((resolver) => resolver.measureEndState());
    resolversToMeasure.forEach((resolver) => {
      if (resolver.suspendedScrollY !== undefined) {
        window.scrollTo(0, resolver.suspendedScrollY);
      }
    });
  }
  anyNeedsMeasurement = false;
  isScheduled = false;
  toResolve.forEach((resolver) => resolver.complete());
  toResolve.clear();
}
function readAllKeyframes() {
  toResolve.forEach((resolver) => {
    resolver.readKeyframes();
    if (resolver.needsMeasurement) {
      anyNeedsMeasurement = true;
    }
  });
}
function flushKeyframeResolvers() {
  readAllKeyframes();
  measureAllKeyframes();
}

class KeyframeResolver {
  constructor(unresolvedKeyframes, onComplete, name, motionValue2, element, isAsync = false) {
    this.isComplete = false;
    this.isAsync = false;
    this.needsMeasurement = false;
    this.isScheduled = false;
    this.unresolvedKeyframes = [...unresolvedKeyframes];
    this.onComplete = onComplete;
    this.name = name;
    this.motionValue = motionValue2;
    this.element = element;
    this.isAsync = isAsync;
  }
  scheduleResolve() {
    this.isScheduled = true;
    if (this.isAsync) {
      toResolve.add(this);
      if (!isScheduled) {
        isScheduled = true;
        frame.read(readAllKeyframes);
        frame.resolveKeyframes(measureAllKeyframes);
      }
    } else {
      this.readKeyframes();
      this.complete();
    }
  }
  readKeyframes() {
    const { unresolvedKeyframes, name, element, motionValue: motionValue2 } = this;
    for (let i = 0;i < unresolvedKeyframes.length; i++) {
      if (unresolvedKeyframes[i] === null) {
        if (i === 0) {
          const currentValue = motionValue2 === null || motionValue2 === undefined ? undefined : motionValue2.get();
          const finalKeyframe = unresolvedKeyframes[unresolvedKeyframes.length - 1];
          if (currentValue !== undefined) {
            unresolvedKeyframes[0] = currentValue;
          } else if (element && name) {
            const valueAsRead = element.readValue(name, finalKeyframe);
            if (valueAsRead !== undefined && valueAsRead !== null) {
              unresolvedKeyframes[0] = valueAsRead;
            }
          }
          if (unresolvedKeyframes[0] === undefined) {
            unresolvedKeyframes[0] = finalKeyframe;
          }
          if (motionValue2 && currentValue === undefined) {
            motionValue2.set(unresolvedKeyframes[0]);
          }
        } else {
          unresolvedKeyframes[i] = unresolvedKeyframes[i - 1];
        }
      }
    }
  }
  setFinalKeyframe() {}
  measureInitialState() {}
  renderEndStyles() {}
  measureEndState() {}
  complete() {
    this.isComplete = true;
    this.onComplete(this.unresolvedKeyframes, this.finalKeyframe);
    toResolve.delete(this);
  }
  cancel() {
    if (!this.isComplete) {
      this.isScheduled = false;
      toResolve.delete(this);
    }
  }
  resume() {
    if (!this.isComplete)
      this.scheduleResolve();
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/is-numerical-string.mjs
var isNumericalString = (v) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(v);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/utils/is-css-variable.mjs
var checkStringStartsWith = (token) => (key) => typeof key === "string" && key.startsWith(token);
var isCSSVariableName = /* @__PURE__ */ checkStringStartsWith("--");
var startsAsVariableToken = /* @__PURE__ */ checkStringStartsWith("var(--");
var isCSSVariableToken = (value) => {
  const startsWithToken = startsAsVariableToken(value);
  if (!startsWithToken)
    return false;
  return singleCssVariableRegex.test(value.split("/*")[0].trim());
};
var singleCssVariableRegex = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/utils/css-variables-conversion.mjs
var splitCSSVariableRegex = /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;
function parseCSSVariable(current) {
  const match = splitCSSVariableRegex.exec(current);
  if (!match)
    return [,];
  const [, token1, token2, fallback] = match;
  return [`--${token1 !== null && token1 !== undefined ? token1 : token2}`, fallback];
}
var maxDepth = 4;
function getVariableValue(current, element, depth = 1) {
  invariant(depth <= maxDepth, `Max CSS variable fallback depth detected in property "${current}". This may indicate a circular fallback dependency.`);
  const [token, fallback] = parseCSSVariable(current);
  if (!token)
    return;
  const resolved = window.getComputedStyle(element).getPropertyValue(token);
  if (resolved) {
    const trimmed = resolved.trim();
    return isNumericalString(trimmed) ? parseFloat(trimmed) : trimmed;
  }
  return isCSSVariableToken(fallback) ? getVariableValue(fallback, element, depth + 1) : fallback;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/value-types/test.mjs
var testValueType = (v) => (type) => type.test(v);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/value-types/type-auto.mjs
var auto = {
  test: (v) => v === "auto",
  parse: (v) => v
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/value-types/dimensions.mjs
var dimensionValueTypes = [number, px, percent, degrees, vw, vh, auto];
var findDimensionValueType = (v) => dimensionValueTypes.find(testValueType(v));

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/DOMKeyframesResolver.mjs
class DOMKeyframesResolver extends KeyframeResolver {
  constructor(unresolvedKeyframes, onComplete, name, motionValue2, element) {
    super(unresolvedKeyframes, onComplete, name, motionValue2, element, true);
  }
  readKeyframes() {
    const { unresolvedKeyframes, element, name } = this;
    if (!element || !element.current)
      return;
    super.readKeyframes();
    for (let i = 0;i < unresolvedKeyframes.length; i++) {
      let keyframe = unresolvedKeyframes[i];
      if (typeof keyframe === "string") {
        keyframe = keyframe.trim();
        if (isCSSVariableToken(keyframe)) {
          const resolved = getVariableValue(keyframe, element.current);
          if (resolved !== undefined) {
            unresolvedKeyframes[i] = resolved;
          }
          if (i === unresolvedKeyframes.length - 1) {
            this.finalKeyframe = keyframe;
          }
        }
      }
    }
    this.resolveNoneKeyframes();
    if (!positionalKeys.has(name) || unresolvedKeyframes.length !== 2) {
      return;
    }
    const [origin, target] = unresolvedKeyframes;
    const originType = findDimensionValueType(origin);
    const targetType = findDimensionValueType(target);
    if (originType === targetType)
      return;
    if (isNumOrPxType(originType) && isNumOrPxType(targetType)) {
      for (let i = 0;i < unresolvedKeyframes.length; i++) {
        const value = unresolvedKeyframes[i];
        if (typeof value === "string") {
          unresolvedKeyframes[i] = parseFloat(value);
        }
      }
    } else {
      this.needsMeasurement = true;
    }
  }
  resolveNoneKeyframes() {
    const { unresolvedKeyframes, name } = this;
    const noneKeyframeIndexes = [];
    for (let i = 0;i < unresolvedKeyframes.length; i++) {
      if (isNone(unresolvedKeyframes[i])) {
        noneKeyframeIndexes.push(i);
      }
    }
    if (noneKeyframeIndexes.length) {
      makeNoneKeyframesAnimatable(unresolvedKeyframes, noneKeyframeIndexes, name);
    }
  }
  measureInitialState() {
    const { element, unresolvedKeyframes, name } = this;
    if (!element || !element.current)
      return;
    if (name === "height") {
      this.suspendedScrollY = window.pageYOffset;
    }
    this.measuredOrigin = positionalValues[name](element.measureViewportBox(), window.getComputedStyle(element.current));
    unresolvedKeyframes[0] = this.measuredOrigin;
    const measureKeyframe = unresolvedKeyframes[unresolvedKeyframes.length - 1];
    if (measureKeyframe !== undefined) {
      element.getValue(name, measureKeyframe).jump(measureKeyframe, false);
    }
  }
  measureEndState() {
    var _a;
    const { element, name, unresolvedKeyframes } = this;
    if (!element || !element.current)
      return;
    const value = element.getValue(name);
    value && value.jump(this.measuredOrigin, false);
    const finalKeyframeIndex = unresolvedKeyframes.length - 1;
    const finalKeyframe = unresolvedKeyframes[finalKeyframeIndex];
    unresolvedKeyframes[finalKeyframeIndex] = positionalValues[name](element.measureViewportBox(), window.getComputedStyle(element.current));
    if (finalKeyframe !== null && this.finalKeyframe === undefined) {
      this.finalKeyframe = finalKeyframe;
    }
    if ((_a = this.removedTransforms) === null || _a === undefined ? undefined : _a.length) {
      this.removedTransforms.forEach(([unsetTransformName, unsetTransformValue]) => {
        element.getValue(unsetTransformName).set(unsetTransformValue);
      });
    }
    this.resolveNoneKeyframes();
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/utils/is-animatable.mjs
var isAnimatable = (value, name) => {
  if (name === "zIndex")
    return false;
  if (typeof value === "number" || Array.isArray(value))
    return true;
  if (typeof value === "string" && (complex.test(value) || value === "0") && !value.startsWith("url(")) {
    return true;
  }
  return false;
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/utils/can-animate.mjs
function hasKeyframesChanged(keyframes) {
  const current = keyframes[0];
  if (keyframes.length === 1)
    return true;
  for (let i = 0;i < keyframes.length; i++) {
    if (keyframes[i] !== current)
      return true;
  }
}
function canAnimate(keyframes, name, type, velocity) {
  const originKeyframe = keyframes[0];
  if (originKeyframe === null)
    return false;
  if (name === "display" || name === "visibility")
    return true;
  const targetKeyframe = keyframes[keyframes.length - 1];
  const isOriginAnimatable = isAnimatable(originKeyframe, name);
  const isTargetAnimatable = isAnimatable(targetKeyframe, name);
  warning(isOriginAnimatable === isTargetAnimatable, `You are trying to animate ${name} from "${originKeyframe}" to "${targetKeyframe}". ${originKeyframe} is not an animatable value - to enable this animation set ${originKeyframe} to a value animatable to ${targetKeyframe} via the \`style\` property.`);
  if (!isOriginAnimatable || !isTargetAnimatable) {
    return false;
  }
  return hasKeyframesChanged(keyframes) || (type === "spring" || isGenerator(type)) && velocity;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/waapi/utils/get-final-keyframe.mjs
var isNotNull = (value) => value !== null;
function getFinalKeyframe(keyframes, { repeat, repeatType = "loop" }, finalKeyframe) {
  const resolvedKeyframes = keyframes.filter(isNotNull);
  const index = repeat && repeatType !== "loop" && repeat % 2 === 1 ? 0 : resolvedKeyframes.length - 1;
  return !index || finalKeyframe === undefined ? resolvedKeyframes[index] : finalKeyframe;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/BaseAnimation.mjs
var MAX_RESOLVE_DELAY = 40;

class BaseAnimation {
  constructor({ autoplay = true, delay = 0, type = "keyframes", repeat = 0, repeatDelay = 0, repeatType = "loop", ...options }) {
    this.isStopped = false;
    this.hasAttemptedResolve = false;
    this.createdAt = time.now();
    this.options = {
      autoplay,
      delay,
      type,
      repeat,
      repeatDelay,
      repeatType,
      ...options
    };
    this.updateFinishedPromise();
  }
  calcStartTime() {
    if (!this.resolvedAt)
      return this.createdAt;
    return this.resolvedAt - this.createdAt > MAX_RESOLVE_DELAY ? this.resolvedAt : this.createdAt;
  }
  get resolved() {
    if (!this._resolved && !this.hasAttemptedResolve) {
      flushKeyframeResolvers();
    }
    return this._resolved;
  }
  onKeyframesResolved(keyframes, finalKeyframe) {
    this.resolvedAt = time.now();
    this.hasAttemptedResolve = true;
    const { name, type, velocity, delay, onComplete, onUpdate, isGenerator: isGenerator2 } = this.options;
    if (!isGenerator2 && !canAnimate(keyframes, name, type, velocity)) {
      if (instantAnimationState.current || !delay) {
        onUpdate && onUpdate(getFinalKeyframe(keyframes, this.options, finalKeyframe));
        onComplete && onComplete();
        this.resolveFinishedPromise();
        return;
      } else {
        this.options.duration = 0;
      }
    }
    const resolvedAnimation = this.initPlayback(keyframes, finalKeyframe);
    if (resolvedAnimation === false)
      return;
    this._resolved = {
      keyframes,
      finalKeyframe,
      ...resolvedAnimation
    };
    this.onPostResolved();
  }
  onPostResolved() {}
  then(resolve, reject) {
    return this.currentFinishedPromise.then(resolve, reject);
  }
  flatten() {
    this.options.type = "keyframes";
    this.options.ease = "linear";
  }
  updateFinishedPromise() {
    this.currentFinishedPromise = new Promise((resolve) => {
      this.resolveFinishedPromise = resolve;
    });
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/hsla-to-rgba.mjs
function hueToRgb(p, q, t) {
  if (t < 0)
    t += 1;
  if (t > 1)
    t -= 1;
  if (t < 1 / 6)
    return p + (q - p) * 6 * t;
  if (t < 1 / 2)
    return q;
  if (t < 2 / 3)
    return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hslaToRgba({ hue, saturation, lightness, alpha: alpha2 }) {
  hue /= 360;
  saturation /= 100;
  lightness /= 100;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (!saturation) {
    red = green = blue = lightness;
  } else {
    const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    red = hueToRgb(p, q, hue + 1 / 3);
    green = hueToRgb(p, q, hue);
    blue = hueToRgb(p, q, hue - 1 / 3);
  }
  return {
    red: Math.round(red * 255),
    green: Math.round(green * 255),
    blue: Math.round(blue * 255),
    alpha: alpha2
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/mix/immediate.mjs
function mixImmediate(a, b) {
  return (p) => p > 0 ? b : a;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/mix/color.mjs
var mixLinearColor = (from, to, v) => {
  const fromExpo = from * from;
  const expo = v * (to * to - fromExpo) + fromExpo;
  return expo < 0 ? 0 : Math.sqrt(expo);
};
var colorTypes = [hex, rgba, hsla];
var getColorType = (v) => colorTypes.find((type) => type.test(v));
function asRGBA(color2) {
  const type = getColorType(color2);
  warning(Boolean(type), `'${color2}' is not an animatable color. Use the equivalent color code instead.`);
  if (!Boolean(type))
    return false;
  let model = type.parse(color2);
  if (type === hsla) {
    model = hslaToRgba(model);
  }
  return model;
}
var mixColor = (from, to) => {
  const fromRGBA = asRGBA(from);
  const toRGBA = asRGBA(to);
  if (!fromRGBA || !toRGBA) {
    return mixImmediate(from, to);
  }
  const blended = { ...fromRGBA };
  return (v) => {
    blended.red = mixLinearColor(fromRGBA.red, toRGBA.red, v);
    blended.green = mixLinearColor(fromRGBA.green, toRGBA.green, v);
    blended.blue = mixLinearColor(fromRGBA.blue, toRGBA.blue, v);
    blended.alpha = mixNumber(fromRGBA.alpha, toRGBA.alpha, v);
    return rgba.transform(blended);
  };
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/pipe.mjs
var combineFunctions = (a, b) => (v) => b(a(v));
var pipe = (...transformers) => transformers.reduce(combineFunctions);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/mix/visibility.mjs
var invisibleValues = new Set(["none", "hidden"]);
function mixVisibility(origin, target) {
  if (invisibleValues.has(origin)) {
    return (p) => p <= 0 ? origin : target;
  } else {
    return (p) => p >= 1 ? target : origin;
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/mix/complex.mjs
function mixNumber2(a, b) {
  return (p) => mixNumber(a, b, p);
}
function getMixer(a) {
  if (typeof a === "number") {
    return mixNumber2;
  } else if (typeof a === "string") {
    return isCSSVariableToken(a) ? mixImmediate : color.test(a) ? mixColor : mixComplex;
  } else if (Array.isArray(a)) {
    return mixArray;
  } else if (typeof a === "object") {
    return color.test(a) ? mixColor : mixObject;
  }
  return mixImmediate;
}
function mixArray(a, b) {
  const output = [...a];
  const numValues = output.length;
  const blendValue = a.map((v, i) => getMixer(v)(v, b[i]));
  return (p) => {
    for (let i = 0;i < numValues; i++) {
      output[i] = blendValue[i](p);
    }
    return output;
  };
}
function mixObject(a, b) {
  const output = { ...a, ...b };
  const blendValue = {};
  for (const key in output) {
    if (a[key] !== undefined && b[key] !== undefined) {
      blendValue[key] = getMixer(a[key])(a[key], b[key]);
    }
  }
  return (v) => {
    for (const key in blendValue) {
      output[key] = blendValue[key](v);
    }
    return output;
  };
}
function matchOrder(origin, target) {
  var _a;
  const orderedOrigin = [];
  const pointers = { color: 0, var: 0, number: 0 };
  for (let i = 0;i < target.values.length; i++) {
    const type = target.types[i];
    const originIndex = origin.indexes[type][pointers[type]];
    const originValue = (_a = origin.values[originIndex]) !== null && _a !== undefined ? _a : 0;
    orderedOrigin[i] = originValue;
    pointers[type]++;
  }
  return orderedOrigin;
}
var mixComplex = (origin, target) => {
  const template = complex.createTransformer(target);
  const originStats = analyseComplexValue(origin);
  const targetStats = analyseComplexValue(target);
  const canInterpolate = originStats.indexes.var.length === targetStats.indexes.var.length && originStats.indexes.color.length === targetStats.indexes.color.length && originStats.indexes.number.length >= targetStats.indexes.number.length;
  if (canInterpolate) {
    if (invisibleValues.has(origin) && !targetStats.values.length || invisibleValues.has(target) && !originStats.values.length) {
      return mixVisibility(origin, target);
    }
    return pipe(mixArray(matchOrder(originStats, targetStats), targetStats.values), template);
  } else {
    warning(true, `Complex values '${origin}' and '${target}' too different to mix. Ensure all colors are of the same type, and that each contains the same quantity of number and color values. Falling back to instant transition.`);
    return mixImmediate(origin, target);
  }
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/mix/index.mjs
function mix(from, to, p) {
  if (typeof from === "number" && typeof to === "number" && typeof p === "number") {
    return mixNumber(from, to, p);
  }
  const mixer = getMixer(from);
  return mixer(from, to);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/generators/inertia.mjs
function inertia({ keyframes, velocity = 0, power = 0.8, timeConstant = 325, bounceDamping = 10, bounceStiffness = 500, modifyTarget, min, max, restDelta = 0.5, restSpeed }) {
  const origin = keyframes[0];
  const state = {
    done: false,
    value: origin
  };
  const isOutOfBounds = (v) => min !== undefined && v < min || max !== undefined && v > max;
  const nearestBoundary = (v) => {
    if (min === undefined)
      return max;
    if (max === undefined)
      return min;
    return Math.abs(min - v) < Math.abs(max - v) ? min : max;
  };
  let amplitude = power * velocity;
  const ideal = origin + amplitude;
  const target = modifyTarget === undefined ? ideal : modifyTarget(ideal);
  if (target !== ideal)
    amplitude = target - origin;
  const calcDelta = (t) => -amplitude * Math.exp(-t / timeConstant);
  const calcLatest = (t) => target + calcDelta(t);
  const applyFriction = (t) => {
    const delta = calcDelta(t);
    const latest = calcLatest(t);
    state.done = Math.abs(delta) <= restDelta;
    state.value = state.done ? target : latest;
  };
  let timeReachedBoundary;
  let spring$1;
  const checkCatchBoundary = (t) => {
    if (!isOutOfBounds(state.value))
      return;
    timeReachedBoundary = t;
    spring$1 = spring({
      keyframes: [state.value, nearestBoundary(state.value)],
      velocity: calcGeneratorVelocity(calcLatest, t, state.value),
      damping: bounceDamping,
      stiffness: bounceStiffness,
      restDelta,
      restSpeed
    });
  };
  checkCatchBoundary(0);
  return {
    calculatedDuration: null,
    next: (t) => {
      let hasUpdatedFrame = false;
      if (!spring$1 && timeReachedBoundary === undefined) {
        hasUpdatedFrame = true;
        applyFriction(t);
        checkCatchBoundary(t);
      }
      if (timeReachedBoundary !== undefined && t >= timeReachedBoundary) {
        return spring$1.next(t - timeReachedBoundary);
      } else {
        !hasUpdatedFrame && applyFriction(t);
        return state;
      }
    }
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/easing/ease.mjs
var easeIn = /* @__PURE__ */ cubicBezier(0.42, 0, 1, 1);
var easeOut = /* @__PURE__ */ cubicBezier(0, 0, 0.58, 1);
var easeInOut = /* @__PURE__ */ cubicBezier(0.42, 0, 0.58, 1);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/easing/utils/map.mjs
var easingLookup = {
  linear: noop,
  easeIn,
  easeInOut,
  easeOut,
  circIn,
  circInOut,
  circOut,
  backIn,
  backInOut,
  backOut,
  anticipate
};
var easingDefinitionToFunction = (definition) => {
  if (isBezierDefinition(definition)) {
    invariant(definition.length === 4, `Cubic bezier arrays must contain four numerical values.`);
    const [x1, y1, x2, y2] = definition;
    return cubicBezier(x1, y1, x2, y2);
  } else if (typeof definition === "string") {
    invariant(easingLookup[definition] !== undefined, `Invalid easing type '${definition}'`);
    return easingLookup[definition];
  }
  return definition;
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/interpolate.mjs
function createMixers(output, ease, customMixer) {
  const mixers = [];
  const mixerFactory = customMixer || mix;
  const numMixers = output.length - 1;
  for (let i = 0;i < numMixers; i++) {
    let mixer = mixerFactory(output[i], output[i + 1]);
    if (ease) {
      const easingFunction = Array.isArray(ease) ? ease[i] || noop : ease;
      mixer = pipe(easingFunction, mixer);
    }
    mixers.push(mixer);
  }
  return mixers;
}
function interpolate(input, output, { clamp: isClamp = true, ease, mixer } = {}) {
  const inputLength = input.length;
  invariant(inputLength === output.length, "Both input and output ranges must be the same length");
  if (inputLength === 1)
    return () => output[0];
  if (inputLength === 2 && output[0] === output[1])
    return () => output[1];
  const isZeroDeltaRange = input[0] === input[1];
  if (input[0] > input[inputLength - 1]) {
    input = [...input].reverse();
    output = [...output].reverse();
  }
  const mixers = createMixers(output, ease, mixer);
  const numMixers = mixers.length;
  const interpolator = (v) => {
    if (isZeroDeltaRange && v < input[0])
      return output[0];
    let i = 0;
    if (numMixers > 1) {
      for (;i < input.length - 2; i++) {
        if (v < input[i + 1])
          break;
      }
    }
    const progressInRange = progress(input[i], input[i + 1], v);
    return mixers[i](progressInRange);
  };
  return isClamp ? (v) => interpolator(clamp(input[0], input[inputLength - 1], v)) : interpolator;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/offsets/time.mjs
function convertOffsetToTimes(offset, duration) {
  return offset.map((o) => o * duration);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/generators/keyframes.mjs
function defaultEasing(values, easing) {
  return values.map(() => easing || easeInOut).splice(0, values.length - 1);
}
function keyframes({ duration = 300, keyframes: keyframeValues, times, ease = "easeInOut" }) {
  const easingFunctions = isEasingArray(ease) ? ease.map(easingDefinitionToFunction) : easingDefinitionToFunction(ease);
  const state = {
    done: false,
    value: keyframeValues[0]
  };
  const absoluteTimes = convertOffsetToTimes(times && times.length === keyframeValues.length ? times : defaultOffset(keyframeValues), duration);
  const mapTimeToKeyframe = interpolate(absoluteTimes, keyframeValues, {
    ease: Array.isArray(easingFunctions) ? easingFunctions : defaultEasing(keyframeValues, easingFunctions)
  });
  return {
    calculatedDuration: duration,
    next: (t) => {
      state.value = mapTimeToKeyframe(t);
      state.done = t >= duration;
      return state;
    }
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/drivers/driver-frameloop.mjs
var frameloopDriver = (update) => {
  const passTimestamp = ({ timestamp }) => update(timestamp);
  return {
    start: () => frame.update(passTimestamp, true),
    stop: () => cancelFrame(passTimestamp),
    now: () => frameData.isProcessing ? frameData.timestamp : time.now()
  };
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/MainThreadAnimation.mjs
var generators = {
  decay: inertia,
  inertia,
  tween: keyframes,
  keyframes,
  spring
};
var percentToProgress = (percent2) => percent2 / 100;

class MainThreadAnimation extends BaseAnimation {
  constructor(options) {
    super(options);
    this.holdTime = null;
    this.cancelTime = null;
    this.currentTime = 0;
    this.playbackSpeed = 1;
    this.pendingPlayState = "running";
    this.startTime = null;
    this.state = "idle";
    this.stop = () => {
      this.resolver.cancel();
      this.isStopped = true;
      if (this.state === "idle")
        return;
      this.teardown();
      const { onStop } = this.options;
      onStop && onStop();
    };
    const { name, motionValue: motionValue2, element, keyframes: keyframes2 } = this.options;
    const KeyframeResolver$1 = (element === null || element === undefined ? undefined : element.KeyframeResolver) || KeyframeResolver;
    const onResolved = (resolvedKeyframes, finalKeyframe) => this.onKeyframesResolved(resolvedKeyframes, finalKeyframe);
    this.resolver = new KeyframeResolver$1(keyframes2, onResolved, name, motionValue2, element);
    this.resolver.scheduleResolve();
  }
  flatten() {
    super.flatten();
    if (this._resolved) {
      Object.assign(this._resolved, this.initPlayback(this._resolved.keyframes));
    }
  }
  initPlayback(keyframes$1) {
    const { type = "keyframes", repeat = 0, repeatDelay = 0, repeatType, velocity = 0 } = this.options;
    const generatorFactory = isGenerator(type) ? type : generators[type] || keyframes;
    let mapPercentToKeyframes;
    let mirroredGenerator;
    if (generatorFactory !== keyframes && typeof keyframes$1[0] !== "number") {
      if (false) {}
      mapPercentToKeyframes = pipe(percentToProgress, mix(keyframes$1[0], keyframes$1[1]));
      keyframes$1 = [0, 100];
    }
    const generator = generatorFactory({ ...this.options, keyframes: keyframes$1 });
    if (repeatType === "mirror") {
      mirroredGenerator = generatorFactory({
        ...this.options,
        keyframes: [...keyframes$1].reverse(),
        velocity: -velocity
      });
    }
    if (generator.calculatedDuration === null) {
      generator.calculatedDuration = calcGeneratorDuration(generator);
    }
    const { calculatedDuration } = generator;
    const resolvedDuration = calculatedDuration + repeatDelay;
    const totalDuration = resolvedDuration * (repeat + 1) - repeatDelay;
    return {
      generator,
      mirroredGenerator,
      mapPercentToKeyframes,
      calculatedDuration,
      resolvedDuration,
      totalDuration
    };
  }
  onPostResolved() {
    const { autoplay = true } = this.options;
    this.play();
    if (this.pendingPlayState === "paused" || !autoplay) {
      this.pause();
    } else {
      this.state = this.pendingPlayState;
    }
  }
  tick(timestamp, sample = false) {
    const { resolved } = this;
    if (!resolved) {
      const { keyframes: keyframes3 } = this.options;
      return { done: true, value: keyframes3[keyframes3.length - 1] };
    }
    const { finalKeyframe, generator, mirroredGenerator, mapPercentToKeyframes, keyframes: keyframes2, calculatedDuration, totalDuration, resolvedDuration } = resolved;
    if (this.startTime === null)
      return generator.next(0);
    const { delay, repeat, repeatType, repeatDelay, onUpdate } = this.options;
    if (this.speed > 0) {
      this.startTime = Math.min(this.startTime, timestamp);
    } else if (this.speed < 0) {
      this.startTime = Math.min(timestamp - totalDuration / this.speed, this.startTime);
    }
    if (sample) {
      this.currentTime = timestamp;
    } else if (this.holdTime !== null) {
      this.currentTime = this.holdTime;
    } else {
      this.currentTime = Math.round(timestamp - this.startTime) * this.speed;
    }
    const timeWithoutDelay = this.currentTime - delay * (this.speed >= 0 ? 1 : -1);
    const isInDelayPhase = this.speed >= 0 ? timeWithoutDelay < 0 : timeWithoutDelay > totalDuration;
    this.currentTime = Math.max(timeWithoutDelay, 0);
    if (this.state === "finished" && this.holdTime === null) {
      this.currentTime = totalDuration;
    }
    let elapsed = this.currentTime;
    let frameGenerator = generator;
    if (repeat) {
      const progress2 = Math.min(this.currentTime, totalDuration) / resolvedDuration;
      let currentIteration = Math.floor(progress2);
      let iterationProgress = progress2 % 1;
      if (!iterationProgress && progress2 >= 1) {
        iterationProgress = 1;
      }
      iterationProgress === 1 && currentIteration--;
      currentIteration = Math.min(currentIteration, repeat + 1);
      const isOddIteration = Boolean(currentIteration % 2);
      if (isOddIteration) {
        if (repeatType === "reverse") {
          iterationProgress = 1 - iterationProgress;
          if (repeatDelay) {
            iterationProgress -= repeatDelay / resolvedDuration;
          }
        } else if (repeatType === "mirror") {
          frameGenerator = mirroredGenerator;
        }
      }
      elapsed = clamp(0, 1, iterationProgress) * resolvedDuration;
    }
    const state = isInDelayPhase ? { done: false, value: keyframes2[0] } : frameGenerator.next(elapsed);
    if (mapPercentToKeyframes) {
      state.value = mapPercentToKeyframes(state.value);
    }
    let { done } = state;
    if (!isInDelayPhase && calculatedDuration !== null) {
      done = this.speed >= 0 ? this.currentTime >= totalDuration : this.currentTime <= 0;
    }
    const isAnimationFinished = this.holdTime === null && (this.state === "finished" || this.state === "running" && done);
    if (isAnimationFinished && finalKeyframe !== undefined) {
      state.value = getFinalKeyframe(keyframes2, this.options, finalKeyframe);
    }
    if (onUpdate) {
      onUpdate(state.value);
    }
    if (isAnimationFinished) {
      this.finish();
    }
    return state;
  }
  get duration() {
    const { resolved } = this;
    return resolved ? millisecondsToSeconds(resolved.calculatedDuration) : 0;
  }
  get time() {
    return millisecondsToSeconds(this.currentTime);
  }
  set time(newTime) {
    newTime = secondsToMilliseconds(newTime);
    this.currentTime = newTime;
    if (this.holdTime !== null || this.speed === 0) {
      this.holdTime = newTime;
    } else if (this.driver) {
      this.startTime = this.driver.now() - newTime / this.speed;
    }
  }
  get speed() {
    return this.playbackSpeed;
  }
  set speed(newSpeed) {
    const hasChanged = this.playbackSpeed !== newSpeed;
    this.playbackSpeed = newSpeed;
    if (hasChanged) {
      this.time = millisecondsToSeconds(this.currentTime);
    }
  }
  play() {
    if (!this.resolver.isScheduled) {
      this.resolver.resume();
    }
    if (!this._resolved) {
      this.pendingPlayState = "running";
      return;
    }
    if (this.isStopped)
      return;
    const { driver = frameloopDriver, onPlay, startTime } = this.options;
    if (!this.driver) {
      this.driver = driver((timestamp) => this.tick(timestamp));
    }
    onPlay && onPlay();
    const now2 = this.driver.now();
    if (this.holdTime !== null) {
      this.startTime = now2 - this.holdTime;
    } else if (!this.startTime) {
      this.startTime = startTime !== null && startTime !== undefined ? startTime : this.calcStartTime();
    } else if (this.state === "finished") {
      this.startTime = now2;
    }
    if (this.state === "finished") {
      this.updateFinishedPromise();
    }
    this.cancelTime = this.startTime;
    this.holdTime = null;
    this.state = "running";
    this.driver.start();
  }
  pause() {
    var _a;
    if (!this._resolved) {
      this.pendingPlayState = "paused";
      return;
    }
    this.state = "paused";
    this.holdTime = (_a = this.currentTime) !== null && _a !== undefined ? _a : 0;
  }
  complete() {
    if (this.state !== "running") {
      this.play();
    }
    this.pendingPlayState = this.state = "finished";
    this.holdTime = null;
  }
  finish() {
    this.teardown();
    this.state = "finished";
    const { onComplete } = this.options;
    onComplete && onComplete();
  }
  cancel() {
    if (this.cancelTime !== null) {
      this.tick(this.cancelTime);
    }
    this.teardown();
    this.updateFinishedPromise();
  }
  teardown() {
    this.state = "idle";
    this.stopDriver();
    this.resolveFinishedPromise();
    this.updateFinishedPromise();
    this.startTime = this.cancelTime = null;
    this.resolver.cancel();
  }
  stopDriver() {
    if (!this.driver)
      return;
    this.driver.stop();
    this.driver = undefined;
  }
  sample(time2) {
    this.startTime = 0;
    return this.tick(time2, true);
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/utils/accelerated-values.mjs
var acceleratedValues = new Set([
  "opacity",
  "clipPath",
  "filter",
  "transform"
]);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/waapi/index.mjs
function startWaapiAnimation(element, valueName, keyframes2, { delay = 0, duration = 300, repeat = 0, repeatType = "loop", ease = "easeInOut", times } = {}) {
  const keyframeOptions = { [valueName]: keyframes2 };
  if (times)
    keyframeOptions.offset = times;
  const easing = mapEasingToNativeEasing(ease, duration);
  if (Array.isArray(easing))
    keyframeOptions.easing = easing;
  return element.animate(keyframeOptions, {
    delay,
    duration,
    easing: !Array.isArray(easing) ? easing : "linear",
    fill: "both",
    iterations: repeat + 1,
    direction: repeatType === "reverse" ? "alternate" : "normal"
  });
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/waapi/utils/supports-waapi.mjs
var supportsWaapi = /* @__PURE__ */ memo(() => Object.hasOwnProperty.call(Element.prototype, "animate"));

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/AcceleratedAnimation.mjs
var sampleDelta = 10;
var maxDuration = 20000;
function requiresPregeneratedKeyframes(options) {
  return isGenerator(options.type) || options.type === "spring" || !isWaapiSupportedEasing(options.ease);
}
function pregenerateKeyframes(keyframes2, options) {
  const sampleAnimation = new MainThreadAnimation({
    ...options,
    keyframes: keyframes2,
    repeat: 0,
    delay: 0,
    isGenerator: true
  });
  let state = { done: false, value: keyframes2[0] };
  const pregeneratedKeyframes = [];
  let t = 0;
  while (!state.done && t < maxDuration) {
    state = sampleAnimation.sample(t);
    pregeneratedKeyframes.push(state.value);
    t += sampleDelta;
  }
  return {
    times: undefined,
    keyframes: pregeneratedKeyframes,
    duration: t - sampleDelta,
    ease: "linear"
  };
}
var unsupportedEasingFunctions = {
  anticipate,
  backInOut,
  circInOut
};
function isUnsupportedEase(key) {
  return key in unsupportedEasingFunctions;
}

class AcceleratedAnimation extends BaseAnimation {
  constructor(options) {
    super(options);
    const { name, motionValue: motionValue2, element, keyframes: keyframes2 } = this.options;
    this.resolver = new DOMKeyframesResolver(keyframes2, (resolvedKeyframes, finalKeyframe) => this.onKeyframesResolved(resolvedKeyframes, finalKeyframe), name, motionValue2, element);
    this.resolver.scheduleResolve();
  }
  initPlayback(keyframes2, finalKeyframe) {
    let { duration = 300, times, ease, type, motionValue: motionValue2, name, startTime } = this.options;
    if (!motionValue2.owner || !motionValue2.owner.current) {
      return false;
    }
    if (typeof ease === "string" && supportsLinearEasing() && isUnsupportedEase(ease)) {
      ease = unsupportedEasingFunctions[ease];
    }
    if (requiresPregeneratedKeyframes(this.options)) {
      const { onComplete, onUpdate, motionValue: motionValue3, element, ...options } = this.options;
      const pregeneratedAnimation = pregenerateKeyframes(keyframes2, options);
      keyframes2 = pregeneratedAnimation.keyframes;
      if (keyframes2.length === 1) {
        keyframes2[1] = keyframes2[0];
      }
      duration = pregeneratedAnimation.duration;
      times = pregeneratedAnimation.times;
      ease = pregeneratedAnimation.ease;
      type = "keyframes";
    }
    const animation = startWaapiAnimation(motionValue2.owner.current, name, keyframes2, { ...this.options, duration, times, ease });
    animation.startTime = startTime !== null && startTime !== undefined ? startTime : this.calcStartTime();
    if (this.pendingTimeline) {
      attachTimeline(animation, this.pendingTimeline);
      this.pendingTimeline = undefined;
    } else {
      animation.onfinish = () => {
        const { onComplete } = this.options;
        motionValue2.set(getFinalKeyframe(keyframes2, this.options, finalKeyframe));
        onComplete && onComplete();
        this.cancel();
        this.resolveFinishedPromise();
      };
    }
    return {
      animation,
      duration,
      times,
      type,
      ease,
      keyframes: keyframes2
    };
  }
  get duration() {
    const { resolved } = this;
    if (!resolved)
      return 0;
    const { duration } = resolved;
    return millisecondsToSeconds(duration);
  }
  get time() {
    const { resolved } = this;
    if (!resolved)
      return 0;
    const { animation } = resolved;
    return millisecondsToSeconds(animation.currentTime || 0);
  }
  set time(newTime) {
    const { resolved } = this;
    if (!resolved)
      return;
    const { animation } = resolved;
    animation.currentTime = secondsToMilliseconds(newTime);
  }
  get speed() {
    const { resolved } = this;
    if (!resolved)
      return 1;
    const { animation } = resolved;
    return animation.playbackRate;
  }
  set speed(newSpeed) {
    const { resolved } = this;
    if (!resolved)
      return;
    const { animation } = resolved;
    animation.playbackRate = newSpeed;
  }
  get state() {
    const { resolved } = this;
    if (!resolved)
      return "idle";
    const { animation } = resolved;
    return animation.playState;
  }
  get startTime() {
    const { resolved } = this;
    if (!resolved)
      return null;
    const { animation } = resolved;
    return animation.startTime;
  }
  attachTimeline(timeline) {
    if (!this._resolved) {
      this.pendingTimeline = timeline;
    } else {
      const { resolved } = this;
      if (!resolved)
        return noop;
      const { animation } = resolved;
      attachTimeline(animation, timeline);
    }
    return noop;
  }
  play() {
    if (this.isStopped)
      return;
    const { resolved } = this;
    if (!resolved)
      return;
    const { animation } = resolved;
    if (animation.playState === "finished") {
      this.updateFinishedPromise();
    }
    animation.play();
  }
  pause() {
    const { resolved } = this;
    if (!resolved)
      return;
    const { animation } = resolved;
    animation.pause();
  }
  stop() {
    this.resolver.cancel();
    this.isStopped = true;
    if (this.state === "idle")
      return;
    this.resolveFinishedPromise();
    this.updateFinishedPromise();
    const { resolved } = this;
    if (!resolved)
      return;
    const { animation, keyframes: keyframes2, duration, type, ease, times } = resolved;
    if (animation.playState === "idle" || animation.playState === "finished") {
      return;
    }
    if (this.time) {
      const { motionValue: motionValue2, onUpdate, onComplete, element, ...options } = this.options;
      const sampleAnimation = new MainThreadAnimation({
        ...options,
        keyframes: keyframes2,
        duration,
        type,
        ease,
        times,
        isGenerator: true
      });
      const sampleTime = secondsToMilliseconds(this.time);
      motionValue2.setWithVelocity(sampleAnimation.sample(sampleTime - sampleDelta).value, sampleAnimation.sample(sampleTime).value, sampleDelta);
    }
    const { onStop } = this.options;
    onStop && onStop();
    this.cancel();
  }
  complete() {
    const { resolved } = this;
    if (!resolved)
      return;
    resolved.animation.finish();
  }
  cancel() {
    const { resolved } = this;
    if (!resolved)
      return;
    resolved.animation.cancel();
  }
  static supports(options) {
    const { motionValue: motionValue2, name, repeatDelay, repeatType, damping, type } = options;
    if (!motionValue2 || !motionValue2.owner || !(motionValue2.owner.current instanceof HTMLElement)) {
      return false;
    }
    const { onUpdate, transformTemplate } = motionValue2.owner.getProps();
    return supportsWaapi() && name && acceleratedValues.has(name) && !onUpdate && !transformTemplate && !repeatDelay && repeatType !== "mirror" && damping !== 0 && type !== "inertia";
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/utils/default-transitions.mjs
var underDampedSpring = {
  type: "spring",
  stiffness: 500,
  damping: 25,
  restSpeed: 10
};
var criticallyDampedSpring = (target) => ({
  type: "spring",
  stiffness: 550,
  damping: target === 0 ? 2 * Math.sqrt(550) : 30,
  restSpeed: 10
});
var keyframesTransition = {
  type: "keyframes",
  duration: 0.8
};
var ease = {
  type: "keyframes",
  ease: [0.25, 0.1, 0.35, 1],
  duration: 0.3
};
var getDefaultTransition = (valueKey, { keyframes: keyframes2 }) => {
  if (keyframes2.length > 2) {
    return keyframesTransition;
  } else if (transformProps.has(valueKey)) {
    return valueKey.startsWith("scale") ? criticallyDampedSpring(keyframes2[1]) : underDampedSpring;
  }
  return ease;
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/utils/is-transition-defined.mjs
function isTransitionDefined({ when, delay: _delay, delayChildren, staggerChildren, staggerDirection, repeat, repeatType, repeatDelay, from, elapsed, ...transition }) {
  return !!Object.keys(transition).length;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/interfaces/motion-value.mjs
var animateMotionValue = (name, value, target, transition = {}, element, isHandoff) => (onComplete) => {
  const valueTransition = getValueTransition2(transition, name) || {};
  const delay = valueTransition.delay || transition.delay || 0;
  let { elapsed = 0 } = transition;
  elapsed = elapsed - secondsToMilliseconds(delay);
  let options = {
    keyframes: Array.isArray(target) ? target : [null, target],
    ease: "easeOut",
    velocity: value.getVelocity(),
    ...valueTransition,
    delay: -elapsed,
    onUpdate: (v) => {
      value.set(v);
      valueTransition.onUpdate && valueTransition.onUpdate(v);
    },
    onComplete: () => {
      onComplete();
      valueTransition.onComplete && valueTransition.onComplete();
    },
    name,
    motionValue: value,
    element: isHandoff ? undefined : element
  };
  if (!isTransitionDefined(valueTransition)) {
    options = {
      ...options,
      ...getDefaultTransition(name, options)
    };
  }
  if (options.duration) {
    options.duration = secondsToMilliseconds(options.duration);
  }
  if (options.repeatDelay) {
    options.repeatDelay = secondsToMilliseconds(options.repeatDelay);
  }
  if (options.from !== undefined) {
    options.keyframes[0] = options.from;
  }
  let shouldSkip = false;
  if (options.type === false || options.duration === 0 && !options.repeatDelay) {
    options.duration = 0;
    if (options.delay === 0) {
      shouldSkip = true;
    }
  }
  if (instantAnimationState.current || MotionGlobalConfig.skipAnimations) {
    shouldSkip = true;
    options.duration = 0;
    options.delay = 0;
  }
  if (shouldSkip && !isHandoff && value.get() !== undefined) {
    const finalKeyframe = getFinalKeyframe(options.keyframes, valueTransition);
    if (finalKeyframe !== undefined) {
      frame.update(() => {
        options.onUpdate(finalKeyframe);
        options.onComplete();
      });
      return new GroupPlaybackControls([]);
    }
  }
  if (!isHandoff && AcceleratedAnimation.supports(options)) {
    return new AcceleratedAnimation(options);
  } else {
    return new MainThreadAnimation(options);
  }
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/interfaces/visual-element-target.mjs
function shouldBlockAnimation({ protectedKeys, needsAnimating }, key) {
  const shouldBlock = protectedKeys.hasOwnProperty(key) && needsAnimating[key] !== true;
  needsAnimating[key] = false;
  return shouldBlock;
}
function animateTarget(visualElement, targetAndTransition, { delay = 0, transitionOverride, type } = {}) {
  var _a;
  let { transition = visualElement.getDefaultTransition(), transitionEnd, ...target } = targetAndTransition;
  if (transitionOverride)
    transition = transitionOverride;
  const animations = [];
  const animationTypeState = type && visualElement.animationState && visualElement.animationState.getState()[type];
  for (const key in target) {
    const value = visualElement.getValue(key, (_a = visualElement.latestValues[key]) !== null && _a !== undefined ? _a : null);
    const valueTarget = target[key];
    if (valueTarget === undefined || animationTypeState && shouldBlockAnimation(animationTypeState, key)) {
      continue;
    }
    const valueTransition = {
      delay,
      ...getValueTransition2(transition || {}, key)
    };
    let isHandoff = false;
    if (window.MotionHandoffAnimation) {
      const appearId = getOptimisedAppearId(visualElement);
      if (appearId) {
        const startTime = window.MotionHandoffAnimation(appearId, key, frame);
        if (startTime !== null) {
          valueTransition.startTime = startTime;
          isHandoff = true;
        }
      }
    }
    addValueToWillChange(visualElement, key);
    value.start(animateMotionValue(key, value, valueTarget, visualElement.shouldReduceMotion && positionalKeys.has(key) ? { type: false } : valueTransition, visualElement, isHandoff));
    const animation = value.animation;
    if (animation) {
      animations.push(animation);
    }
  }
  if (transitionEnd) {
    Promise.all(animations).then(() => {
      frame.update(() => {
        transitionEnd && setTarget(visualElement, transitionEnd);
      });
    });
  }
  return animations;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/utils/is-svg-element.mjs
function isSVGElement(element) {
  return element instanceof SVGElement && element.tagName !== "svg";
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/projection/geometry/models.mjs
var createAxis = () => ({ min: 0, max: 0 });
var createBox = () => ({
  x: createAxis(),
  y: createAxis()
});

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/motion/features/definitions.mjs
var featureProps = {
  animation: [
    "animate",
    "variants",
    "whileHover",
    "whileTap",
    "exit",
    "whileInView",
    "whileFocus",
    "whileDrag"
  ],
  exit: ["exit"],
  drag: ["drag", "dragControls"],
  focus: ["whileFocus"],
  hover: ["whileHover", "onHoverStart", "onHoverEnd"],
  tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
  pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
  inView: ["whileInView", "onViewportEnter", "onViewportLeave"],
  layout: ["layout", "layoutId"]
};
var featureDefinitions = {};
for (const key in featureProps) {
  featureDefinitions[key] = {
    isEnabled: (props) => featureProps[key].some((name) => !!props[name])
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/is-browser.mjs
var isBrowser = typeof window !== "undefined";

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/reduced-motion/state.mjs
var prefersReducedMotion = { current: null };
var hasReducedMotionListener = { current: false };

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/reduced-motion/index.mjs
function initPrefersReducedMotion() {
  hasReducedMotionListener.current = true;
  if (!isBrowser)
    return;
  if (window.matchMedia) {
    const motionMediaQuery = window.matchMedia("(prefers-reduced-motion)");
    const setReducedMotionPreferences = () => prefersReducedMotion.current = motionMediaQuery.matches;
    motionMediaQuery.addListener(setReducedMotionPreferences);
    setReducedMotionPreferences();
  } else {
    prefersReducedMotion.current = false;
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/value-types/find.mjs
var valueTypes = [...dimensionValueTypes, color, complex];
var findValueType = (v) => valueTypes.find(testValueType(v));

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/utils/is-animation-controls.mjs
function isAnimationControls(v) {
  return v !== null && typeof v === "object" && typeof v.start === "function";
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/utils/is-variant-label.mjs
function isVariantLabel(v) {
  return typeof v === "string" || Array.isArray(v);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/utils/variant-props.mjs
var variantPriorityOrder = [
  "animate",
  "whileInView",
  "whileFocus",
  "whileHover",
  "whileTap",
  "whileDrag",
  "exit"
];
var variantProps = ["initial", ...variantPriorityOrder];

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/utils/is-controlling-variants.mjs
function isControllingVariants(props) {
  return isAnimationControls(props.animate) || variantProps.some((name) => isVariantLabel(props[name]));
}
function isVariantNode(props) {
  return Boolean(isControllingVariants(props) || props.variants);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/utils/motion-values.mjs
function updateMotionValuesFromProps(element, next, prev) {
  for (const key in next) {
    const nextValue = next[key];
    const prevValue = prev[key];
    if (isMotionValue(nextValue)) {
      element.addValue(key, nextValue);
      if (false) {}
    } else if (isMotionValue(prevValue)) {
      element.addValue(key, motionValue(nextValue, { owner: element }));
    } else if (prevValue !== nextValue) {
      if (element.hasValue(key)) {
        const existingValue = element.getValue(key);
        if (existingValue.liveStyle === true) {
          existingValue.jump(nextValue);
        } else if (!existingValue.hasAnimated) {
          existingValue.set(nextValue);
        }
      } else {
        const latestValue = element.getStaticValue(key);
        element.addValue(key, motionValue(latestValue !== undefined ? latestValue : nextValue, { owner: element }));
      }
    }
  }
  for (const key in prev) {
    if (next[key] === undefined)
      element.removeValue(key);
  }
  return next;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/VisualElement.mjs
var propEventHandlers = [
  "AnimationStart",
  "AnimationComplete",
  "Update",
  "BeforeLayoutMeasure",
  "LayoutMeasure",
  "LayoutAnimationStart",
  "LayoutAnimationComplete"
];

class VisualElement {
  scrapeMotionValuesFromProps(_props, _prevProps, _visualElement) {
    return {};
  }
  constructor({ parent, props, presenceContext, reducedMotionConfig, blockInitialAnimation, visualState }, options = {}) {
    this.current = null;
    this.children = new Set;
    this.isVariantNode = false;
    this.isControllingVariants = false;
    this.shouldReduceMotion = null;
    this.values = new Map;
    this.KeyframeResolver = KeyframeResolver;
    this.features = {};
    this.valueSubscriptions = new Map;
    this.prevMotionValues = {};
    this.events = {};
    this.propEventSubscriptions = {};
    this.notifyUpdate = () => this.notify("Update", this.latestValues);
    this.render = () => {
      if (!this.current)
        return;
      this.triggerBuild();
      this.renderInstance(this.current, this.renderState, this.props.style, this.projection);
    };
    this.renderScheduledAt = 0;
    this.scheduleRender = () => {
      const now2 = time.now();
      if (this.renderScheduledAt < now2) {
        this.renderScheduledAt = now2;
        frame.render(this.render, false, true);
      }
    };
    const { latestValues, renderState, onUpdate } = visualState;
    this.onUpdate = onUpdate;
    this.latestValues = latestValues;
    this.baseTarget = { ...latestValues };
    this.initialValues = props.initial ? { ...latestValues } : {};
    this.renderState = renderState;
    this.parent = parent;
    this.props = props;
    this.presenceContext = presenceContext;
    this.depth = parent ? parent.depth + 1 : 0;
    this.reducedMotionConfig = reducedMotionConfig;
    this.options = options;
    this.blockInitialAnimation = Boolean(blockInitialAnimation);
    this.isControllingVariants = isControllingVariants(props);
    this.isVariantNode = isVariantNode(props);
    if (this.isVariantNode) {
      this.variantChildren = new Set;
    }
    this.manuallyAnimateOnMount = Boolean(parent && parent.current);
    const { willChange, ...initialMotionValues } = this.scrapeMotionValuesFromProps(props, {}, this);
    for (const key in initialMotionValues) {
      const value = initialMotionValues[key];
      if (latestValues[key] !== undefined && isMotionValue(value)) {
        value.set(latestValues[key], false);
      }
    }
  }
  mount(instance) {
    this.current = instance;
    visualElementStore.set(instance, this);
    if (this.projection && !this.projection.instance) {
      this.projection.mount(instance);
    }
    if (this.parent && this.isVariantNode && !this.isControllingVariants) {
      this.removeFromVariantTree = this.parent.addVariantChild(this);
    }
    this.values.forEach((value, key) => this.bindToMotionValue(key, value));
    if (!hasReducedMotionListener.current) {
      initPrefersReducedMotion();
    }
    this.shouldReduceMotion = this.reducedMotionConfig === "never" ? false : this.reducedMotionConfig === "always" ? true : prefersReducedMotion.current;
    if (false) {}
    if (this.parent)
      this.parent.children.add(this);
    this.update(this.props, this.presenceContext);
  }
  unmount() {
    visualElementStore.delete(this.current);
    this.projection && this.projection.unmount();
    cancelFrame(this.notifyUpdate);
    cancelFrame(this.render);
    this.valueSubscriptions.forEach((remove) => remove());
    this.valueSubscriptions.clear();
    this.removeFromVariantTree && this.removeFromVariantTree();
    this.parent && this.parent.children.delete(this);
    for (const key in this.events) {
      this.events[key].clear();
    }
    for (const key in this.features) {
      const feature = this.features[key];
      if (feature) {
        feature.unmount();
        feature.isMounted = false;
      }
    }
    this.current = null;
  }
  bindToMotionValue(key, value) {
    if (this.valueSubscriptions.has(key)) {
      this.valueSubscriptions.get(key)();
    }
    const valueIsTransform = transformProps.has(key);
    const removeOnChange = value.on("change", (latestValue) => {
      this.latestValues[key] = latestValue;
      this.props.onUpdate && frame.preRender(this.notifyUpdate);
      if (valueIsTransform && this.projection) {
        this.projection.isTransformDirty = true;
      }
    });
    const removeOnRenderRequest = value.on("renderRequest", this.scheduleRender);
    let removeSyncCheck;
    if (window.MotionCheckAppearSync) {
      removeSyncCheck = window.MotionCheckAppearSync(this, key, value);
    }
    this.valueSubscriptions.set(key, () => {
      removeOnChange();
      removeOnRenderRequest();
      if (removeSyncCheck)
        removeSyncCheck();
      if (value.owner)
        value.stop();
    });
  }
  sortNodePosition(other) {
    if (!this.current || !this.sortInstanceNodePosition || this.type !== other.type) {
      return 0;
    }
    return this.sortInstanceNodePosition(this.current, other.current);
  }
  updateFeatures() {
    let key = "animation";
    for (key in featureDefinitions) {
      const featureDefinition = featureDefinitions[key];
      if (!featureDefinition)
        continue;
      const { isEnabled, Feature: FeatureConstructor } = featureDefinition;
      if (!this.features[key] && FeatureConstructor && isEnabled(this.props)) {
        this.features[key] = new FeatureConstructor(this);
      }
      if (this.features[key]) {
        const feature = this.features[key];
        if (feature.isMounted) {
          feature.update();
        } else {
          feature.mount();
          feature.isMounted = true;
        }
      }
    }
  }
  triggerBuild() {
    this.build(this.renderState, this.latestValues, this.props);
  }
  measureViewportBox() {
    return this.current ? this.measureInstanceViewportBox(this.current, this.props) : createBox();
  }
  getStaticValue(key) {
    return this.latestValues[key];
  }
  setStaticValue(key, value) {
    this.latestValues[key] = value;
  }
  update(props, presenceContext) {
    if (props.transformTemplate || this.props.transformTemplate) {
      this.scheduleRender();
    }
    this.prevProps = this.props;
    this.props = props;
    this.prevPresenceContext = this.presenceContext;
    this.presenceContext = presenceContext;
    for (let i = 0;i < propEventHandlers.length; i++) {
      const key = propEventHandlers[i];
      if (this.propEventSubscriptions[key]) {
        this.propEventSubscriptions[key]();
        delete this.propEventSubscriptions[key];
      }
      const listenerName = "on" + key;
      const listener = props[listenerName];
      if (listener) {
        this.propEventSubscriptions[key] = this.on(key, listener);
      }
    }
    this.prevMotionValues = updateMotionValuesFromProps(this, this.scrapeMotionValuesFromProps(props, this.prevProps, this), this.prevMotionValues);
    if (this.handleChildMotionValue) {
      this.handleChildMotionValue();
    }
    this.onUpdate && this.onUpdate(this);
  }
  getProps() {
    return this.props;
  }
  getVariant(name) {
    return this.props.variants ? this.props.variants[name] : undefined;
  }
  getDefaultTransition() {
    return this.props.transition;
  }
  getTransformPagePoint() {
    return this.props.transformPagePoint;
  }
  getClosestVariantNode() {
    return this.isVariantNode ? this : this.parent ? this.parent.getClosestVariantNode() : undefined;
  }
  addVariantChild(child) {
    const closestVariantNode = this.getClosestVariantNode();
    if (closestVariantNode) {
      closestVariantNode.variantChildren && closestVariantNode.variantChildren.add(child);
      return () => closestVariantNode.variantChildren.delete(child);
    }
  }
  addValue(key, value) {
    const existingValue = this.values.get(key);
    if (value !== existingValue) {
      if (existingValue)
        this.removeValue(key);
      this.bindToMotionValue(key, value);
      this.values.set(key, value);
      this.latestValues[key] = value.get();
    }
  }
  removeValue(key) {
    this.values.delete(key);
    const unsubscribe = this.valueSubscriptions.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.valueSubscriptions.delete(key);
    }
    delete this.latestValues[key];
    this.removeValueFromRenderState(key, this.renderState);
  }
  hasValue(key) {
    return this.values.has(key);
  }
  getValue(key, defaultValue) {
    if (this.props.values && this.props.values[key]) {
      return this.props.values[key];
    }
    let value = this.values.get(key);
    if (value === undefined && defaultValue !== undefined) {
      value = motionValue(defaultValue === null ? undefined : defaultValue, { owner: this });
      this.addValue(key, value);
    }
    return value;
  }
  readValue(key, target) {
    var _a;
    let value = this.latestValues[key] !== undefined || !this.current ? this.latestValues[key] : (_a = this.getBaseTargetFromProps(this.props, key)) !== null && _a !== undefined ? _a : this.readValueFromInstance(this.current, key, this.options);
    if (value !== undefined && value !== null) {
      if (typeof value === "string" && (isNumericalString(value) || isZeroValueString(value))) {
        value = parseFloat(value);
      } else if (!findValueType(value) && complex.test(target)) {
        value = getAnimatableNone2(key, target);
      }
      this.setBaseTarget(key, isMotionValue(value) ? value.get() : value);
    }
    return isMotionValue(value) ? value.get() : value;
  }
  setBaseTarget(key, value) {
    this.baseTarget[key] = value;
  }
  getBaseTarget(key) {
    var _a;
    const { initial } = this.props;
    let valueFromInitial;
    if (typeof initial === "string" || typeof initial === "object") {
      const variant = resolveVariantFromProps(this.props, initial, (_a = this.presenceContext) === null || _a === undefined ? undefined : _a.custom);
      if (variant) {
        valueFromInitial = variant[key];
      }
    }
    if (initial && valueFromInitial !== undefined) {
      return valueFromInitial;
    }
    const target = this.getBaseTargetFromProps(this.props, key);
    if (target !== undefined && !isMotionValue(target))
      return target;
    return this.initialValues[key] !== undefined && valueFromInitial === undefined ? undefined : this.baseTarget[key];
  }
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = new SubscriptionManager;
    }
    return this.events[eventName].add(callback);
  }
  notify(eventName, ...args) {
    if (this.events[eventName]) {
      this.events[eventName].notify(...args);
    }
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/DOMVisualElement.mjs
class DOMVisualElement extends VisualElement {
  constructor() {
    super(...arguments);
    this.KeyframeResolver = DOMKeyframesResolver;
  }
  sortInstanceNodePosition(a, b) {
    return a.compareDocumentPosition(b) & 2 ? 1 : -1;
  }
  getBaseTargetFromProps(props, key) {
    return props.style ? props.style[key] : undefined;
  }
  removeValueFromRenderState(key, { vars, style }) {
    delete vars[key];
    delete style[key];
  }
  handleChildMotionValue() {
    if (this.childSubscription) {
      this.childSubscription();
      delete this.childSubscription;
    }
    const { children } = this.props;
    if (isMotionValue(children)) {
      this.childSubscription = children.on("change", (latest) => {
        if (this.current) {
          this.current.textContent = `${latest}`;
        }
      });
    }
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/value-types/get-as-type.mjs
var getValueAsType = (value, type) => {
  return type && typeof value === "number" ? type.transform(value) : value;
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/html/utils/build-transform.mjs
var translateAlias = {
  x: "translateX",
  y: "translateY",
  z: "translateZ",
  transformPerspective: "perspective"
};
var numTransforms = transformPropOrder.length;
function buildTransform(latestValues, transform, transformTemplate) {
  let transformString = "";
  let transformIsDefault = true;
  for (let i = 0;i < numTransforms; i++) {
    const key = transformPropOrder[i];
    const value = latestValues[key];
    if (value === undefined)
      continue;
    let valueIsDefault = true;
    if (typeof value === "number") {
      valueIsDefault = value === (key.startsWith("scale") ? 1 : 0);
    } else {
      valueIsDefault = parseFloat(value) === 0;
    }
    if (!valueIsDefault || transformTemplate) {
      const valueAsType = getValueAsType(value, numberValueTypes[key]);
      if (!valueIsDefault) {
        transformIsDefault = false;
        const transformName = translateAlias[key] || key;
        transformString += `${transformName}(${valueAsType}) `;
      }
      if (transformTemplate) {
        transform[key] = valueAsType;
      }
    }
  }
  transformString = transformString.trim();
  if (transformTemplate) {
    transformString = transformTemplate(transform, transformIsDefault ? "" : transformString);
  } else if (transformIsDefault) {
    transformString = "none";
  }
  return transformString;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/html/utils/build-styles.mjs
function buildHTMLStyles(state, latestValues, transformTemplate) {
  const { style, vars, transformOrigin } = state;
  let hasTransform = false;
  let hasTransformOrigin = false;
  for (const key in latestValues) {
    const value = latestValues[key];
    if (transformProps.has(key)) {
      hasTransform = true;
      continue;
    } else if (isCSSVariableName(key)) {
      vars[key] = value;
      continue;
    } else {
      const valueAsType = getValueAsType(value, numberValueTypes[key]);
      if (key.startsWith("origin")) {
        hasTransformOrigin = true;
        transformOrigin[key] = valueAsType;
      } else {
        style[key] = valueAsType;
      }
    }
  }
  if (!latestValues.transform) {
    if (hasTransform || transformTemplate) {
      style.transform = buildTransform(latestValues, state.transform, transformTemplate);
    } else if (style.transform) {
      style.transform = "none";
    }
  }
  if (hasTransformOrigin) {
    const { originX = "50%", originY = "50%", originZ = 0 } = transformOrigin;
    style.transformOrigin = `${originX} ${originY} ${originZ}`;
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/svg/utils/path.mjs
var dashKeys = {
  offset: "stroke-dashoffset",
  array: "stroke-dasharray"
};
var camelKeys = {
  offset: "strokeDashoffset",
  array: "strokeDasharray"
};
function buildSVGPath(attrs, length, spacing = 1, offset = 0, useDashCase = true) {
  attrs.pathLength = 1;
  const keys = useDashCase ? dashKeys : camelKeys;
  attrs[keys.offset] = px.transform(-offset);
  const pathLength = px.transform(length);
  const pathSpacing = px.transform(spacing);
  attrs[keys.array] = `${pathLength} ${pathSpacing}`;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/svg/utils/transform-origin.mjs
function calcOrigin(origin, offset, size) {
  return typeof origin === "string" ? origin : px.transform(offset + size * origin);
}
function calcSVGTransformOrigin(dimensions, originX, originY) {
  const pxOriginX = calcOrigin(originX, dimensions.x, dimensions.width);
  const pxOriginY = calcOrigin(originY, dimensions.y, dimensions.height);
  return `${pxOriginX} ${pxOriginY}`;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/svg/utils/build-attrs.mjs
function buildSVGAttrs(state, {
  attrX,
  attrY,
  attrScale,
  originX,
  originY,
  pathLength,
  pathSpacing = 1,
  pathOffset = 0,
  ...latest
}, isSVGTag, transformTemplate) {
  buildHTMLStyles(state, latest, transformTemplate);
  if (isSVGTag) {
    if (state.style.viewBox) {
      state.attrs.viewBox = state.style.viewBox;
    }
    return;
  }
  state.attrs = state.style;
  state.style = {};
  const { attrs, style, dimensions } = state;
  if (attrs.transform) {
    if (dimensions)
      style.transform = attrs.transform;
    delete attrs.transform;
  }
  if (dimensions && (originX !== undefined || originY !== undefined || style.transform)) {
    style.transformOrigin = calcSVGTransformOrigin(dimensions, originX !== undefined ? originX : 0.5, originY !== undefined ? originY : 0.5);
  }
  if (attrX !== undefined)
    attrs.x = attrX;
  if (attrY !== undefined)
    attrs.y = attrY;
  if (attrScale !== undefined)
    attrs.scale = attrScale;
  if (pathLength !== undefined) {
    buildSVGPath(attrs, pathLength, pathSpacing, pathOffset, false);
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/svg/utils/camel-case-attrs.mjs
var camelCaseAttributes = new Set([
  "baseFrequency",
  "diffuseConstant",
  "kernelMatrix",
  "kernelUnitLength",
  "keySplines",
  "keyTimes",
  "limitingConeAngle",
  "markerHeight",
  "markerWidth",
  "numOctaves",
  "targetX",
  "targetY",
  "surfaceScale",
  "specularConstant",
  "specularExponent",
  "stdDeviation",
  "tableValues",
  "viewBox",
  "gradientTransform",
  "pathLength",
  "startOffset",
  "textLength",
  "lengthAdjust"
]);

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/svg/utils/is-svg-tag.mjs
var isSVGTag = (tag) => typeof tag === "string" && tag.toLowerCase() === "svg";

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/html/utils/render.mjs
function renderHTML(element, { style, vars }, styleProp, projection) {
  Object.assign(element.style, style, projection && projection.getProjectionStyles(styleProp));
  for (const key in vars) {
    element.style.setProperty(key, vars[key]);
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/svg/utils/render.mjs
function renderSVG(element, renderState, _styleProp, projection) {
  renderHTML(element, renderState, undefined, projection);
  for (const key in renderState.attrs) {
    element.setAttribute(!camelCaseAttributes.has(key) ? camelToDash(key) : key, renderState.attrs[key]);
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/projection/styles/scale-correction.mjs
var scaleCorrectors = {};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/motion/utils/is-forced-motion-value.mjs
function isForcedMotionValue(key, { layout, layoutId }) {
  return transformProps.has(key) || key.startsWith("origin") || (layout || layoutId !== undefined) && (!!scaleCorrectors[key] || key === "opacity");
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/html/utils/scrape-motion-values.mjs
function scrapeMotionValuesFromProps(props, prevProps, visualElement) {
  var _a;
  const { style } = props;
  const newValues = {};
  for (const key in style) {
    if (isMotionValue(style[key]) || prevProps.style && isMotionValue(prevProps.style[key]) || isForcedMotionValue(key, props) || ((_a = visualElement === null || visualElement === undefined ? undefined : visualElement.getValue(key)) === null || _a === undefined ? undefined : _a.liveStyle) !== undefined) {
      newValues[key] = style[key];
    }
  }
  return newValues;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/svg/utils/scrape-motion-values.mjs
function scrapeMotionValuesFromProps2(props, prevProps, visualElement) {
  const newValues = scrapeMotionValuesFromProps(props, prevProps, visualElement);
  for (const key in props) {
    if (isMotionValue(props[key]) || isMotionValue(prevProps[key])) {
      const targetKey = transformPropOrder.indexOf(key) !== -1 ? "attr" + key.charAt(0).toUpperCase() + key.substring(1) : key;
      newValues[targetKey] = props[key];
    }
  }
  return newValues;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/svg/SVGVisualElement.mjs
class SVGVisualElement extends DOMVisualElement {
  constructor() {
    super(...arguments);
    this.type = "svg";
    this.isSVGTag = false;
    this.measureInstanceViewportBox = createBox;
  }
  getBaseTargetFromProps(props, key) {
    return props[key];
  }
  readValueFromInstance(instance, key) {
    if (transformProps.has(key)) {
      const defaultType = getDefaultValueType(key);
      return defaultType ? defaultType.default || 0 : 0;
    }
    key = !camelCaseAttributes.has(key) ? camelToDash(key) : key;
    return instance.getAttribute(key);
  }
  scrapeMotionValuesFromProps(props, prevProps, visualElement) {
    return scrapeMotionValuesFromProps2(props, prevProps, visualElement);
  }
  build(renderState, latestValues, props) {
    buildSVGAttrs(renderState, latestValues, this.isSVGTag, props.transformTemplate);
  }
  renderInstance(instance, renderState, styleProp, projection) {
    renderSVG(instance, renderState, styleProp, projection);
  }
  mount(instance) {
    this.isSVGTag = isSVGTag(instance.tagName);
    super.mount(instance);
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/projection/geometry/conversion.mjs
function convertBoundingBoxToBox({ top, left, right, bottom }) {
  return {
    x: { min: left, max: right },
    y: { min: top, max: bottom }
  };
}
function transformBoxPoints(point, transformPoint) {
  if (!transformPoint)
    return point;
  const topLeft = transformPoint({ x: point.left, y: point.top });
  const bottomRight = transformPoint({ x: point.right, y: point.bottom });
  return {
    top: topLeft.y,
    left: topLeft.x,
    bottom: bottomRight.y,
    right: bottomRight.x
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/projection/utils/measure.mjs
function measureViewportBox(instance, transformPoint) {
  return convertBoundingBoxToBox(transformBoxPoints(instance.getBoundingClientRect(), transformPoint));
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/html/HTMLVisualElement.mjs
function getComputedStyle2(element) {
  return window.getComputedStyle(element);
}

class HTMLVisualElement extends DOMVisualElement {
  constructor() {
    super(...arguments);
    this.type = "html";
    this.renderInstance = renderHTML;
  }
  readValueFromInstance(instance, key) {
    if (transformProps.has(key)) {
      const defaultType = getDefaultValueType(key);
      return defaultType ? defaultType.default || 0 : 0;
    } else {
      const computedStyle = getComputedStyle2(instance);
      const value = (isCSSVariableName(key) ? computedStyle.getPropertyValue(key) : computedStyle[key]) || 0;
      return typeof value === "string" ? value.trim() : value;
    }
  }
  measureInstanceViewportBox(instance, { transformPagePoint }) {
    return measureViewportBox(instance, transformPagePoint);
  }
  build(renderState, latestValues, props) {
    buildHTMLStyles(renderState, latestValues, props.transformTemplate);
  }
  scrapeMotionValuesFromProps(props, prevProps, visualElement) {
    return scrapeMotionValuesFromProps(props, prevProps, visualElement);
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/object/ObjectVisualElement.mjs
function isObjectKey(key, object) {
  return key in object;
}

class ObjectVisualElement extends VisualElement {
  constructor() {
    super(...arguments);
    this.type = "object";
  }
  readValueFromInstance(instance, key) {
    if (isObjectKey(key, instance)) {
      const value = instance[key];
      if (typeof value === "string" || typeof value === "number") {
        return value;
      }
    }
    return;
  }
  getBaseTargetFromProps() {
    return;
  }
  removeValueFromRenderState(key, renderState) {
    delete renderState.output[key];
  }
  measureInstanceViewportBox() {
    return createBox();
  }
  build(renderState, latestValues) {
    Object.assign(renderState.output, latestValues);
  }
  renderInstance(instance, { output }) {
    Object.assign(instance, output);
  }
  sortInstanceNodePosition() {
    return 0;
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/utils/create-visual-element.mjs
function createDOMVisualElement(element) {
  const options = {
    presenceContext: null,
    props: {},
    visualState: {
      renderState: {
        transform: {},
        transformOrigin: {},
        style: {},
        vars: {},
        attrs: {}
      },
      latestValues: {}
    }
  };
  const node = isSVGElement(element) ? new SVGVisualElement(options) : new HTMLVisualElement(options);
  node.mount(element);
  visualElementStore.set(element, node);
}
function createObjectVisualElement(subject) {
  const options = {
    presenceContext: null,
    props: {},
    visualState: {
      renderState: {
        output: {}
      },
      latestValues: {}
    }
  };
  const node = new ObjectVisualElement(options);
  node.mount(subject);
  visualElementStore.set(subject, node);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animate/single-value.mjs
function animateSingleValue(value, keyframes2, options) {
  const motionValue$1 = isMotionValue(value) ? value : motionValue(value);
  motionValue$1.start(animateMotionValue("", motionValue$1, keyframes2, options));
  return motionValue$1.animation;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animate/subject.mjs
function isSingleValue(subject, keyframes2) {
  return isMotionValue(subject) || typeof subject === "number" || typeof subject === "string" && !isDOMKeyframes(keyframes2);
}
function animateSubject(subject, keyframes2, options, scope) {
  const animations = [];
  if (isSingleValue(subject, keyframes2)) {
    animations.push(animateSingleValue(subject, isDOMKeyframes(keyframes2) ? keyframes2.default || keyframes2 : keyframes2, options ? options.default || options : options));
  } else {
    const subjects = resolveSubjects(subject, keyframes2, scope);
    const numSubjects = subjects.length;
    invariant(Boolean(numSubjects), "No valid elements provided.");
    for (let i = 0;i < numSubjects; i++) {
      const thisSubject = subjects[i];
      const createVisualElement = thisSubject instanceof Element ? createDOMVisualElement : createObjectVisualElement;
      if (!visualElementStore.has(thisSubject)) {
        createVisualElement(thisSubject);
      }
      const visualElement = visualElementStore.get(thisSubject);
      const transition = { ...options };
      if ("delay" in transition && typeof transition.delay === "function") {
        transition.delay = transition.delay(i, numSubjects);
      }
      animations.push(...animateTarget(visualElement, { ...keyframes2, transition }, {}));
    }
  }
  return animations;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animate/sequence.mjs
function animateSequence(sequence, options, scope) {
  const animations = [];
  const animationDefinitions = createAnimationsFromSequence(sequence, options, scope, { spring });
  animationDefinitions.forEach(({ keyframes: keyframes2, transition }, subject) => {
    animations.push(...animateSubject(subject, keyframes2, transition));
  });
  return animations;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animate/index.mjs
function isSequence(value) {
  return Array.isArray(value) && value.some(Array.isArray);
}
function createScopedAnimate(scope) {
  function scopedAnimate(subjectOrSequence, optionsOrKeyframes, options) {
    let animations = [];
    if (isSequence(subjectOrSequence)) {
      animations = animateSequence(subjectOrSequence, optionsOrKeyframes, scope);
    } else {
      animations = animateSubject(subjectOrSequence, optionsOrKeyframes, options, scope);
    }
    const animation = new GroupPlaybackControls(animations);
    if (scope) {
      scope.animations.push(animation);
    }
    return animation;
  }
  return scopedAnimate;
}
var animate = createScopedAnimate();
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/motion-dom/dist/es/animation/waapi/NativeAnimationControls.mjs
class NativeAnimationControls {
  constructor(animation) {
    this.animation = animation;
  }
  get duration() {
    var _a, _b, _c;
    const durationInMs = ((_b = (_a = this.animation) === null || _a === undefined ? undefined : _a.effect) === null || _b === undefined ? undefined : _b.getComputedTiming().duration) || ((_c = this.options) === null || _c === undefined ? undefined : _c.duration) || 300;
    return millisecondsToSeconds(Number(durationInMs));
  }
  get time() {
    var _a;
    if (this.animation) {
      return millisecondsToSeconds(((_a = this.animation) === null || _a === undefined ? undefined : _a.currentTime) || 0);
    }
    return 0;
  }
  set time(newTime) {
    if (this.animation) {
      this.animation.currentTime = secondsToMilliseconds(newTime);
    }
  }
  get speed() {
    return this.animation ? this.animation.playbackRate : 1;
  }
  set speed(newSpeed) {
    if (this.animation) {
      this.animation.playbackRate = newSpeed;
    }
  }
  get state() {
    return this.animation ? this.animation.playState : "finished";
  }
  get startTime() {
    return this.animation ? this.animation.startTime : null;
  }
  get finished() {
    return this.animation ? this.animation.finished : Promise.resolve();
  }
  play() {
    this.animation && this.animation.play();
  }
  pause() {
    this.animation && this.animation.pause();
  }
  stop() {
    if (!this.animation || this.state === "idle" || this.state === "finished") {
      return;
    }
    if (this.animation.commitStyles) {
      this.animation.commitStyles();
    }
    this.cancel();
  }
  flatten() {
    var _a;
    if (!this.animation)
      return;
    (_a = this.animation.effect) === null || _a === undefined || _a.updateTiming({ easing: "linear" });
  }
  attachTimeline(timeline) {
    if (this.animation)
      attachTimeline(this.animation, timeline);
    return noop;
  }
  complete() {
    this.animation && this.animation.finish();
  }
  cancel() {
    try {
      this.animation && this.animation.cancel();
    } catch (e) {}
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/waapi/utils/style.mjs
function setCSSVar(element, name, value) {
  element.style.setProperty(`--${name}`, value);
}
function setStyle(element, name, value) {
  element.style[name] = value;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/waapi/utils/supports-partial-keyframes.mjs
var supportsPartialKeyframes = /* @__PURE__ */ memo(() => {
  try {
    document.createElement("div").animate({ opacity: [1] });
  } catch (e) {
    return false;
  }
  return true;
});

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/waapi/NativeAnimation.mjs
var state = new WeakMap;
function hydrateKeyframes(valueName, keyframes2, read) {
  for (let i = 0;i < keyframes2.length; i++) {
    if (keyframes2[i] === null) {
      keyframes2[i] = i === 0 ? read() : keyframes2[i - 1];
    }
    if (typeof keyframes2[i] === "number" && browserNumberValueTypes[valueName]) {
      keyframes2[i] = browserNumberValueTypes[valueName].transform(keyframes2[i]);
    }
  }
  if (!supportsPartialKeyframes() && keyframes2.length < 2) {
    keyframes2.unshift(read());
  }
}
var defaultEasing2 = "easeOut";
function getElementAnimationState(element) {
  const animationState = state.get(element) || new Map;
  state.set(element, animationState);
  return state.get(element);
}

class NativeAnimation extends NativeAnimationControls {
  constructor(element, valueName, valueKeyframes, options) {
    const isCSSVar = valueName.startsWith("--");
    invariant(typeof options.type !== "string", `animateMini doesn't support "type" as a string. Did you mean to import { spring } from "framer-motion"?`);
    const existingAnimation = getElementAnimationState(element).get(valueName);
    existingAnimation && existingAnimation.stop();
    const readInitialKeyframe = () => {
      return valueName.startsWith("--") ? element.style.getPropertyValue(valueName) : window.getComputedStyle(element)[valueName];
    };
    if (!Array.isArray(valueKeyframes)) {
      valueKeyframes = [valueKeyframes];
    }
    hydrateKeyframes(valueName, valueKeyframes, readInitialKeyframe);
    if (isGenerator(options.type)) {
      const generatorOptions = createGeneratorEasing(options, 100, options.type);
      options.ease = supportsLinearEasing() ? generatorOptions.ease : defaultEasing2;
      options.duration = secondsToMilliseconds(generatorOptions.duration);
      options.type = "keyframes";
    } else {
      options.ease = options.ease || defaultEasing2;
    }
    const onFinish = () => {
      this.setValue(element, valueName, getFinalKeyframe(valueKeyframes, options));
      this.cancel();
      this.resolveFinishedPromise();
    };
    const init = () => {
      this.setValue = isCSSVar ? setCSSVar : setStyle;
      this.options = options;
      this.updateFinishedPromise();
      this.removeAnimation = () => {
        const elementState = state.get(element);
        elementState && elementState.delete(valueName);
      };
    };
    if (!supportsWaapi()) {
      super();
      init();
      onFinish();
    } else {
      super(startWaapiAnimation(element, valueName, valueKeyframes, options));
      init();
      if (options.autoplay === false) {
        this.animation.pause();
      }
      this.animation.onfinish = onFinish;
      getElementAnimationState(element).set(valueName, this);
    }
  }
  then(resolve, reject) {
    return this.currentFinishedPromise.then(resolve, reject);
  }
  updateFinishedPromise() {
    this.currentFinishedPromise = new Promise((resolve) => {
      this.resolveFinishedPromise = resolve;
    });
  }
  play() {
    if (this.state === "finished") {
      this.updateFinishedPromise();
    }
    super.play();
  }
  cancel() {
    this.removeAnimation();
    super.cancel();
  }
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/waapi/animate-elements.mjs
function animateElements(elementOrSelector, keyframes2, options, scope) {
  const elements = resolveElements(elementOrSelector, scope);
  const numElements = elements.length;
  invariant(Boolean(numElements), "No valid element provided.");
  const animations = [];
  for (let i = 0;i < numElements; i++) {
    const element = elements[i];
    const elementTransition = { ...options };
    if (typeof elementTransition.delay === "function") {
      elementTransition.delay = elementTransition.delay(i, numElements);
    }
    for (const valueName in keyframes2) {
      const valueKeyframes = keyframes2[valueName];
      const valueOptions = {
        ...getValueTransition2(elementTransition, valueName)
      };
      valueOptions.duration = valueOptions.duration ? secondsToMilliseconds(valueOptions.duration) : valueOptions.duration;
      valueOptions.delay = secondsToMilliseconds(valueOptions.delay || 0);
      animations.push(new NativeAnimation(element, valueName, valueKeyframes, valueOptions));
    }
  }
  return animations;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/animators/waapi/animate-style.mjs
var createScopedWaapiAnimate = (scope) => {
  function scopedAnimate(elementOrSelector, keyframes2, options) {
    return new GroupPlaybackControls(animateElements(elementOrSelector, keyframes2, options, scope));
  }
  return scopedAnimate;
};
var animateMini = /* @__PURE__ */ createScopedWaapiAnimate();
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/scroll/observe.mjs
function observeTimeline(update, timeline) {
  let prevProgress;
  const onFrame = () => {
    const { currentTime } = timeline;
    const percentage = currentTime === null ? 0 : currentTime.value;
    const progress2 = percentage / 100;
    if (prevProgress !== progress2) {
      update(progress2);
    }
    prevProgress = progress2;
  };
  frame.update(onFrame, true);
  return () => cancelFrame(onFrame);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/resize/handle-element.mjs
var resizeHandlers = new WeakMap;
var observer;
function getElementSize(target, borderBoxSize) {
  if (borderBoxSize) {
    const { inlineSize, blockSize } = borderBoxSize[0];
    return { width: inlineSize, height: blockSize };
  } else if (target instanceof SVGElement && "getBBox" in target) {
    return target.getBBox();
  } else {
    return {
      width: target.offsetWidth,
      height: target.offsetHeight
    };
  }
}
function notifyTarget({ target, contentRect, borderBoxSize }) {
  var _a;
  (_a = resizeHandlers.get(target)) === null || _a === undefined || _a.forEach((handler) => {
    handler({
      target,
      contentSize: contentRect,
      get size() {
        return getElementSize(target, borderBoxSize);
      }
    });
  });
}
function notifyAll(entries) {
  entries.forEach(notifyTarget);
}
function createResizeObserver() {
  if (typeof ResizeObserver === "undefined")
    return;
  observer = new ResizeObserver(notifyAll);
}
function resizeElement(target, handler) {
  if (!observer)
    createResizeObserver();
  const elements = resolveElements(target);
  elements.forEach((element) => {
    let elementHandlers = resizeHandlers.get(element);
    if (!elementHandlers) {
      elementHandlers = new Set;
      resizeHandlers.set(element, elementHandlers);
    }
    elementHandlers.add(handler);
    observer === null || observer === undefined || observer.observe(element);
  });
  return () => {
    elements.forEach((element) => {
      const elementHandlers = resizeHandlers.get(element);
      elementHandlers === null || elementHandlers === undefined || elementHandlers.delete(handler);
      if (!(elementHandlers === null || elementHandlers === undefined ? undefined : elementHandlers.size)) {
        observer === null || observer === undefined || observer.unobserve(element);
      }
    });
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/resize/handle-window.mjs
var windowCallbacks = new Set;
var windowResizeHandler;
function createWindowResizeHandler() {
  windowResizeHandler = () => {
    const size = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    const info = {
      target: window,
      size,
      contentSize: size
    };
    windowCallbacks.forEach((callback) => callback(info));
  };
  window.addEventListener("resize", windowResizeHandler);
}
function resizeWindow(callback) {
  windowCallbacks.add(callback);
  if (!windowResizeHandler)
    createWindowResizeHandler();
  return () => {
    windowCallbacks.delete(callback);
    if (!windowCallbacks.size && windowResizeHandler) {
      windowResizeHandler = undefined;
    }
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/resize/index.mjs
function resize(a, b) {
  return typeof a === "function" ? resizeWindow(a) : resizeElement(a, b);
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/scroll/info.mjs
var maxElapsed2 = 50;
var createAxisInfo = () => ({
  current: 0,
  offset: [],
  progress: 0,
  scrollLength: 0,
  targetOffset: 0,
  targetLength: 0,
  containerLength: 0,
  velocity: 0
});
var createScrollInfo = () => ({
  time: 0,
  x: createAxisInfo(),
  y: createAxisInfo()
});
var keys = {
  x: {
    length: "Width",
    position: "Left"
  },
  y: {
    length: "Height",
    position: "Top"
  }
};
function updateAxisInfo(element, axisName, info, time2) {
  const axis = info[axisName];
  const { length, position } = keys[axisName];
  const prev = axis.current;
  const prevTime = info.time;
  axis.current = element[`scroll${position}`];
  axis.scrollLength = element[`scroll${length}`] - element[`client${length}`];
  axis.offset.length = 0;
  axis.offset[0] = 0;
  axis.offset[1] = axis.scrollLength;
  axis.progress = progress(0, axis.scrollLength, axis.current);
  const elapsed = time2 - prevTime;
  axis.velocity = elapsed > maxElapsed2 ? 0 : velocityPerSecond(axis.current - prev, elapsed);
}
function updateScrollInfo(element, info, time2) {
  updateAxisInfo(element, "x", info, time2);
  updateAxisInfo(element, "y", info, time2);
  info.time = time2;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/scroll/offsets/inset.mjs
function calcInset(element, container) {
  const inset = { x: 0, y: 0 };
  let current = element;
  while (current && current !== container) {
    if (current instanceof HTMLElement) {
      inset.x += current.offsetLeft;
      inset.y += current.offsetTop;
      current = current.offsetParent;
    } else if (current.tagName === "svg") {
      const svgBoundingBox = current.getBoundingClientRect();
      current = current.parentElement;
      const parentBoundingBox = current.getBoundingClientRect();
      inset.x += svgBoundingBox.left - parentBoundingBox.left;
      inset.y += svgBoundingBox.top - parentBoundingBox.top;
    } else if (current instanceof SVGGraphicsElement) {
      const { x, y } = current.getBBox();
      inset.x += x;
      inset.y += y;
      let svg = null;
      let parent = current.parentNode;
      while (!svg) {
        if (parent.tagName === "svg") {
          svg = parent;
        }
        parent = current.parentNode;
      }
      current = svg;
    } else {
      break;
    }
  }
  return inset;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/scroll/offsets/edge.mjs
var namedEdges = {
  start: 0,
  center: 0.5,
  end: 1
};
function resolveEdge(edge, length, inset = 0) {
  let delta = 0;
  if (edge in namedEdges) {
    edge = namedEdges[edge];
  }
  if (typeof edge === "string") {
    const asNumber = parseFloat(edge);
    if (edge.endsWith("px")) {
      delta = asNumber;
    } else if (edge.endsWith("%")) {
      edge = asNumber / 100;
    } else if (edge.endsWith("vw")) {
      delta = asNumber / 100 * document.documentElement.clientWidth;
    } else if (edge.endsWith("vh")) {
      delta = asNumber / 100 * document.documentElement.clientHeight;
    } else {
      edge = asNumber;
    }
  }
  if (typeof edge === "number") {
    delta = length * edge;
  }
  return inset + delta;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/scroll/offsets/offset.mjs
var defaultOffset2 = [0, 0];
function resolveOffset(offset, containerLength, targetLength, targetInset) {
  let offsetDefinition = Array.isArray(offset) ? offset : defaultOffset2;
  let targetPoint = 0;
  let containerPoint = 0;
  if (typeof offset === "number") {
    offsetDefinition = [offset, offset];
  } else if (typeof offset === "string") {
    offset = offset.trim();
    if (offset.includes(" ")) {
      offsetDefinition = offset.split(" ");
    } else {
      offsetDefinition = [offset, namedEdges[offset] ? offset : `0`];
    }
  }
  targetPoint = resolveEdge(offsetDefinition[0], targetLength, targetInset);
  containerPoint = resolveEdge(offsetDefinition[1], containerLength);
  return targetPoint - containerPoint;
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/scroll/offsets/presets.mjs
var ScrollOffset = {
  Enter: [
    [0, 1],
    [1, 1]
  ],
  Exit: [
    [0, 0],
    [1, 0]
  ],
  Any: [
    [1, 0],
    [0, 1]
  ],
  All: [
    [0, 0],
    [1, 1]
  ]
};

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/scroll/offsets/index.mjs
var point = { x: 0, y: 0 };
function getTargetSize(target) {
  return "getBBox" in target && target.tagName !== "svg" ? target.getBBox() : { width: target.clientWidth, height: target.clientHeight };
}
function resolveOffsets(container, info, options) {
  const { offset: offsetDefinition = ScrollOffset.All } = options;
  const { target = container, axis = "y" } = options;
  const lengthLabel = axis === "y" ? "height" : "width";
  const inset = target !== container ? calcInset(target, container) : point;
  const targetSize = target === container ? { width: container.scrollWidth, height: container.scrollHeight } : getTargetSize(target);
  const containerSize = {
    width: container.clientWidth,
    height: container.clientHeight
  };
  info[axis].offset.length = 0;
  let hasChanged = !info[axis].interpolate;
  const numOffsets = offsetDefinition.length;
  for (let i = 0;i < numOffsets; i++) {
    const offset = resolveOffset(offsetDefinition[i], containerSize[lengthLabel], targetSize[lengthLabel], inset[axis]);
    if (!hasChanged && offset !== info[axis].interpolatorOffsets[i]) {
      hasChanged = true;
    }
    info[axis].offset[i] = offset;
  }
  if (hasChanged) {
    info[axis].interpolate = interpolate(info[axis].offset, defaultOffset(offsetDefinition), { clamp: false });
    info[axis].interpolatorOffsets = [...info[axis].offset];
  }
  info[axis].progress = clamp(0, 1, info[axis].interpolate(info[axis].current));
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/scroll/on-scroll-handler.mjs
function measure(container, target = container, info) {
  info.x.targetOffset = 0;
  info.y.targetOffset = 0;
  if (target !== container) {
    let node = target;
    while (node && node !== container) {
      info.x.targetOffset += node.offsetLeft;
      info.y.targetOffset += node.offsetTop;
      node = node.offsetParent;
    }
  }
  info.x.targetLength = target === container ? target.scrollWidth : target.clientWidth;
  info.y.targetLength = target === container ? target.scrollHeight : target.clientHeight;
  info.x.containerLength = container.clientWidth;
  info.y.containerLength = container.clientHeight;
  if (false) {}
}
function createOnScrollHandler(element, onScroll, info, options = {}) {
  return {
    measure: () => measure(element, options.target, info),
    update: (time2) => {
      updateScrollInfo(element, info, time2);
      if (options.offset || options.target) {
        resolveOffsets(element, info, options);
      }
    },
    notify: () => onScroll(info)
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/scroll/track.mjs
var scrollListeners = new WeakMap;
var resizeListeners = new WeakMap;
var onScrollHandlers = new WeakMap;
var getEventTarget = (element) => element === document.documentElement ? window : element;
function scrollInfo(onScroll, { container = document.documentElement, ...options } = {}) {
  let containerHandlers = onScrollHandlers.get(container);
  if (!containerHandlers) {
    containerHandlers = new Set;
    onScrollHandlers.set(container, containerHandlers);
  }
  const info = createScrollInfo();
  const containerHandler = createOnScrollHandler(container, onScroll, info, options);
  containerHandlers.add(containerHandler);
  if (!scrollListeners.has(container)) {
    const measureAll = () => {
      for (const handler of containerHandlers)
        handler.measure();
    };
    const updateAll = () => {
      for (const handler of containerHandlers) {
        handler.update(frameData.timestamp);
      }
    };
    const notifyAll2 = () => {
      for (const handler of containerHandlers)
        handler.notify();
    };
    const listener2 = () => {
      frame.read(measureAll, false, true);
      frame.read(updateAll, false, true);
      frame.update(notifyAll2, false, true);
    };
    scrollListeners.set(container, listener2);
    const target = getEventTarget(container);
    window.addEventListener("resize", listener2, { passive: true });
    if (container !== document.documentElement) {
      resizeListeners.set(container, resize(container, listener2));
    }
    target.addEventListener("scroll", listener2, { passive: true });
  }
  const listener = scrollListeners.get(container);
  frame.read(listener, false, true);
  return () => {
    var _a;
    cancelFrame(listener);
    const currentHandlers = onScrollHandlers.get(container);
    if (!currentHandlers)
      return;
    currentHandlers.delete(containerHandler);
    if (currentHandlers.size)
      return;
    const scrollListener = scrollListeners.get(container);
    scrollListeners.delete(container);
    if (scrollListener) {
      getEventTarget(container).removeEventListener("scroll", scrollListener);
      (_a = resizeListeners.get(container)) === null || _a === undefined || _a();
      window.removeEventListener("resize", scrollListener);
    }
  };
}

// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/scroll/index.mjs
function scrollTimelineFallback({ source, container, axis = "y" }) {
  if (source)
    container = source;
  const currentTime = { value: 0 };
  const cancel = scrollInfo((info) => {
    currentTime.value = info[axis].progress * 100;
  }, { container, axis });
  return { currentTime, cancel };
}
var timelineCache = new Map;
function getTimeline({ source, container = document.documentElement, axis = "y" } = {}) {
  if (source)
    container = source;
  if (!timelineCache.has(container)) {
    timelineCache.set(container, {});
  }
  const elementCache = timelineCache.get(container);
  if (!elementCache[axis]) {
    elementCache[axis] = supportsScrollTimeline() ? new ScrollTimeline({ source: container, axis }) : scrollTimelineFallback({ source: container, axis });
  }
  return elementCache[axis];
}
function isOnScrollWithInfo(onScroll) {
  return onScroll.length === 2;
}
function needsElementTracking(options) {
  return options && (options.target || options.offset);
}
function scrollFunction(onScroll, options) {
  if (isOnScrollWithInfo(onScroll) || needsElementTracking(options)) {
    return scrollInfo((info) => {
      onScroll(info[options.axis].progress, info);
    }, options);
  } else {
    return observeTimeline(onScroll, getTimeline(options));
  }
}
function scrollAnimation(animation, options) {
  animation.flatten();
  if (needsElementTracking(options)) {
    animation.pause();
    return scrollInfo((info) => {
      animation.time = animation.duration * info[options.axis].progress;
    }, options);
  } else {
    const timeline = getTimeline(options);
    if (animation.attachTimeline) {
      return animation.attachTimeline(timeline, (valueAnimation) => {
        valueAnimation.pause();
        return observeTimeline((progress2) => {
          valueAnimation.time = valueAnimation.duration * progress2;
        }, timeline);
      });
    } else {
      return noop;
    }
  }
}
function scroll(onScroll, { axis = "y", ...options } = {}) {
  const optionsWithDefaults = { axis, ...options };
  return typeof onScroll === "function" ? scrollFunction(onScroll, optionsWithDefaults) : scrollAnimation(onScroll, optionsWithDefaults);
}
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/render/dom/viewport/index.mjs
var thresholds = {
  some: 0,
  all: 1
};
function inView(elementOrSelector, onStart, { root, margin: rootMargin, amount = "some" } = {}) {
  const elements = resolveElements(elementOrSelector);
  const activeIntersections = new WeakMap;
  const onIntersectionChange = (entries) => {
    entries.forEach((entry) => {
      const onEnd = activeIntersections.get(entry.target);
      if (entry.isIntersecting === Boolean(onEnd))
        return;
      if (entry.isIntersecting) {
        const newOnEnd = onStart(entry);
        if (typeof newOnEnd === "function") {
          activeIntersections.set(entry.target, newOnEnd);
        } else {
          observer2.unobserve(entry.target);
        }
      } else if (typeof onEnd === "function") {
        onEnd(entry);
        activeIntersections.delete(entry.target);
      }
    });
  };
  const observer2 = new IntersectionObserver(onIntersectionChange, {
    root,
    rootMargin,
    threshold: typeof amount === "number" ? amount : thresholds[amount]
  });
  elements.forEach((element) => observer2.observe(element));
  return () => observer2.disconnect();
}
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/easing/steps.mjs
function steps(numSteps, direction = "end") {
  return (progress2) => {
    progress2 = direction === "end" ? Math.min(progress2, 0.999) : Math.max(progress2, 0.001);
    const expanded = progress2 * numSteps;
    const rounded = direction === "end" ? Math.floor(expanded) : Math.ceil(expanded);
    return clamp(0, 1, rounded / numSteps);
  };
}
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/animation/utils/stagger.mjs
function getOriginIndex(from, total) {
  if (from === "first") {
    return 0;
  } else {
    const lastIndex = total - 1;
    return from === "last" ? lastIndex : lastIndex / 2;
  }
}
function stagger(duration = 0.1, { startDelay = 0, from = 0, ease: ease2 } = {}) {
  return (i, total) => {
    const fromIndex = typeof from === "number" ? from : getOriginIndex(from, total);
    const distance = Math.abs(fromIndex - i);
    let delay = duration * distance;
    if (ease2) {
      const maxDelay = total * duration;
      const easingFunction = easingDefinitionToFunction(ease2);
      delay = easingFunction(delay / maxDelay) * maxDelay;
    }
    return startDelay + delay;
  };
}
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/delay.mjs
function delay(callback, timeout) {
  const start = time.now();
  const checkElapsed = ({ timestamp }) => {
    const elapsed = timestamp - start;
    if (elapsed >= timeout) {
      cancelFrame(checkElapsed);
      callback(elapsed - timeout);
    }
  };
  frame.read(checkElapsed, true);
  return () => cancelFrame(checkElapsed);
}
function delayInSeconds(callback, timeout) {
  return delay(callback, secondsToMilliseconds(timeout));
}
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/distance.mjs
var distance = (a, b) => Math.abs(a - b);
function distance2D(a, b) {
  const xDelta = distance(a.x, b.x);
  const yDelta = distance(a.y, b.y);
  return Math.sqrt(xDelta ** 2 + yDelta ** 2);
}
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/utils/transform.mjs
var isCustomValueType = (v) => {
  return v && typeof v === "object" && v.mix;
};
var getMixer2 = (v) => isCustomValueType(v) ? v.mix : undefined;
function transform(...args) {
  const useImmediate = !Array.isArray(args[0]);
  const argOffset = useImmediate ? 0 : -1;
  const inputValue = args[0 + argOffset];
  const inputRange = args[1 + argOffset];
  const outputRange = args[2 + argOffset];
  const options = args[3 + argOffset];
  const interpolator = interpolate(inputRange, outputRange, {
    mixer: getMixer2(outputRange[0]),
    ...options
  });
  return useImmediate ? interpolator(inputValue) : interpolator;
}
// ../../../node_modules/.pnpm/motion@11.18.2_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/motion/dist/es/framer-motion/dist/es/frameloop/index-legacy.mjs
var sync = frame;
var cancelSync = stepsOrder.reduce((acc, key) => {
  acc[key] = (process) => cancelFrame(process);
  return acc;
}, {});
// synth:/Users/iagh/git/claude-design/plugins/design/dev-server/.runtime-bundle-motion-entry.tsx
var {
  MotionValue: MotionValue2,
  animate: animate2,
  animateMini: animateMini2,
  anticipate: anticipate2,
  backIn: backIn2,
  backInOut: backInOut2,
  backOut: backOut2,
  cancelFrame: cancelFrame2,
  cancelSync: cancelSync2,
  circIn: circIn2,
  circInOut: circInOut2,
  circOut: circOut2,
  clamp: clamp2,
  createScopedAnimate: createScopedAnimate2,
  cubicBezier: cubicBezier2,
  delay: delay2,
  distance: distance2,
  distance2D: distance2D2,
  easeIn: easeIn2,
  easeInOut: easeInOut2,
  easeOut: easeOut2,
  frame: frame2,
  frameData: frameData2,
  frameSteps: frameSteps2,
  inView: inView2,
  inertia: inertia2,
  interpolate: interpolate2,
  invariant: invariant2,
  isDragActive: isDragActive2,
  keyframes: keyframes2,
  mirrorEasing: mirrorEasing2,
  mix: mix2,
  motionValue: motionValue2,
  noop: noop2,
  pipe: pipe2,
  progress: progress2,
  reverseEasing: reverseEasing2,
  scroll: scroll2,
  scrollInfo: scrollInfo2,
  spring: spring2,
  stagger: stagger2,
  steps: steps2,
  sync: sync2,
  time: time2,
  transform: transform2,
  wrap: wrap2
} = exports_lib;
var __runtime_bundle_motion_entry_default = exports_lib;
export {
  wrap2 as wrap,
  transform2 as transform,
  time2 as time,
  sync2 as sync,
  steps2 as steps,
  stagger2 as stagger,
  spring2 as spring,
  scrollInfo2 as scrollInfo,
  scroll2 as scroll,
  reverseEasing2 as reverseEasing,
  progress2 as progress,
  pipe2 as pipe,
  noop2 as noop,
  motionValue2 as motionValue,
  mix2 as mix,
  mirrorEasing2 as mirrorEasing,
  keyframes2 as keyframes,
  isDragActive2 as isDragActive,
  invariant2 as invariant,
  interpolate2 as interpolate,
  inertia2 as inertia,
  inView2 as inView,
  frameSteps2 as frameSteps,
  frameData2 as frameData,
  frame2 as frame,
  easeOut2 as easeOut,
  easeInOut2 as easeInOut,
  easeIn2 as easeIn,
  distance2D2 as distance2D,
  distance2 as distance,
  delay2 as delay,
  __runtime_bundle_motion_entry_default as default,
  cubicBezier2 as cubicBezier,
  createScopedAnimate2 as createScopedAnimate,
  clamp2 as clamp,
  circOut2 as circOut,
  circInOut2 as circInOut,
  circIn2 as circIn,
  cancelSync2 as cancelSync,
  cancelFrame2 as cancelFrame,
  backOut2 as backOut,
  backInOut2 as backInOut,
  backIn2 as backIn,
  anticipate2 as anticipate,
  animateMini2 as animateMini,
  animate2 as animate,
  MotionValue2 as MotionValue
};
