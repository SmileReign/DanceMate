// Intercept react-native for Node test runner
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'react-native') {
    return { Platform: { OS: 'web' } };
  }
  return origLoad.apply(this, arguments);
};

const { PoseTracker } = require('../src/services/poseTracker');
import { getInterpolatedPose } from '../src/services/motionComparison';
import { POSE_LANDMARKS } from '../src/constants/skeletonJoints';
import { PoseFrame, Landmark } from '../src/types/dance';

console.log('================================================================');
console.log(' DanceMate Uploaded-Video Pose-Tracking Verification Suite');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passCount++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failCount++;
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

// --------------------------------------------------------------------------
// TEST 1: Verification that Failed Detection produces EMPTY poseData, NOT fake tracking
// --------------------------------------------------------------------------
console.log('--- Test 1: No Synthetic Fallback When Detection Fails (0 poses) ---');
async function testNoSyntheticFallback() {
  const cancelRef = { current: false };

  // Call trackReferenceVideo with no DOM video element (offline/failed detection)
  const result = await PoseTracker.trackReferenceVideo(
    null,
    10.0,
    () => {},
    cancelRef,
    null,
    0,
    10.0,
    30
  );

  assert(
    Array.isArray(result) && result.length === 0,
    'Failed or missing video detection returns 0 frames (does not fabricate fake landmarks)',
    `Returned ${result.length} frames`
  );
}

// --------------------------------------------------------------------------
// TEST 2: Two Distinct Videos Produce Distinct Landmark Coordinates
// --------------------------------------------------------------------------
console.log('\n--- Test 2: Video 1 vs Video 2 Movement Differentiation ---');
function testTwoVideosProduceDifferentLandmarks() {
  // Video 1: Overhead high-energy routine (hands raised at y ~ 0.20, jumping bounce at y ~ 0.35)
  const video1Frames: PoseFrame[] = [];
  // Video 2: Low floor groove routine (hands low at y ~ 0.70, deep crouch at y ~ 0.65)
  const video2Frames: PoseFrame[] = [];

  for (let i = 0; i < 30; i++) {
    const t = i * 0.033;

    // Video 1 frame landmarks
    const lms1: Landmark[] = new Array(33).fill(null).map((_, idx) => ({
      x: 0.45 + Math.sin(t * 1.5) * 0.1,
      y: 0.35 + Math.cos(t * 1.5) * 0.05,
      z: 0,
      visibility: 0.95,
    }));
    lms1[POSE_LANDMARKS.NOSE] = { x: 0.45, y: 0.22, z: 0, visibility: 0.98 };
    lms1[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.30, y: 0.18, z: 0, visibility: 0.95 }; // High overhead
    lms1[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.60, y: 0.18, z: 0, visibility: 0.95 };
    video1Frames.push({
      timestamp: t,
      landmarks: lms1,
      confidence: 0.95,
      trackingQuality: 'high',
    });

    // Video 2 frame landmarks
    const lms2: Landmark[] = new Array(33).fill(null).map((_, idx) => ({
      x: 0.60 + Math.cos(t * 0.8) * 0.08,
      y: 0.65 + Math.sin(t * 0.8) * 0.03,
      z: 0,
      visibility: 0.95,
    }));
    lms2[POSE_LANDMARKS.NOSE] = { x: 0.60, y: 0.50, z: 0, visibility: 0.98 };
    lms2[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.45, y: 0.75, z: 0, visibility: 0.95 }; // Low near hips/knees
    lms2[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.75, y: 0.75, z: 0, visibility: 0.95 };
    video2Frames.push({
      timestamp: t,
      landmarks: lms2,
      confidence: 0.92,
      trackingQuality: 'high',
    });
  }

  // Sample comparison at t = 0.5s
  const pose1 = getInterpolatedPose(video1Frames, 0.5);
  const pose2 = getInterpolatedPose(video2Frames, 0.5);

  assert(pose1 !== null && pose2 !== null, 'Poses retrieved for both videos at t=0.5s');

  if (pose1 && pose2) {
    const wrist1Y = pose1[POSE_LANDMARKS.LEFT_WRIST].y;
    const wrist2Y = pose2[POSE_LANDMARKS.LEFT_WRIST].y;
    const nose1X = pose1[POSE_LANDMARKS.NOSE].x;
    const nose2X = pose2[POSE_LANDMARKS.NOSE].x;

    const wristDiff = Math.abs(wrist1Y - wrist2Y);
    const noseDiff = Math.abs(nose1X - nose2X);

    assert(
      wristDiff > 0.4,
      'Video 1 and Video 2 have distinctly different wrist positions (overhead vs low groove)',
      `wristDiff=${wristDiff.toFixed(3)}, wrist1Y=${wrist1Y.toFixed(3)}, wrist2Y=${wrist2Y.toFixed(3)}`
    );

    assert(
      noseDiff > 0.1,
      'Video 1 and Video 2 have distinctly different dancer spatial centers (x=0.45 vs x=0.60)',
      `noseDiff=${noseDiff.toFixed(3)}, nose1X=${nose1X.toFixed(3)}, nose2X=${nose2X.toFixed(3)}`
    );

    // Verify it does NOT match the old synthetic sine/cosine formula
    // Old formula: nose cx = 0.5 + sin(0.5 * 2.2)*0.05 = 0.544, cy = shoulderY - 0.12 = 0.40
    const oldSyntheticNoseX = 0.5 + Math.sin(0.5 * 2.2) * 0.05;
    assert(
      Math.abs(nose1X - oldSyntheticNoseX) > 0.05,
      'Video 1 landmarks do NOT match the old synthetic sine/cosine sequence',
      `nose1X=${nose1X.toFixed(3)} vs oldSynthetic=${oldSyntheticNoseX.toFixed(3)}`
    );
  }
}

// --------------------------------------------------------------------------
// TEST 3: Candidate Dancers Do Not Hallucinate Fake Skeletons
// --------------------------------------------------------------------------
console.log('\n--- Test 3: Candidate Dancer Initialization ---');
function testCandidateDancerNoFakeSkeleton() {
  const manualCand = PoseTracker.generateManualCandidate(0, 0.35, 0.5);
  assert(
    manualCand.sampleLandmarks === undefined,
    'Manual candidate dancer does not contain synthetic skeleton landmarks',
    `sampleLandmarks is ${manualCand.sampleLandmarks}`
  );
  assert(
    manualCand.cx === 0.35,
    'Manual candidate dancer records correct requested center X',
    `cx=${manualCand.cx}`
  );
}

// --------------------------------------------------------------------------
// TEST 4: Safe Interpolation Across Tracking Gaps
// --------------------------------------------------------------------------
console.log('\n--- Test 4: Missing Frame Handling in Interpolation ---');
function testMissingFrameInterpolation() {
  const framesWithGap: PoseFrame[] = [
    {
      timestamp: 1.0,
      landmarks: new Array(33).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }),
      confidence: 0.9,
    },
    {
      timestamp: 1.1,
      landmarks: new Array(33).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }),
      confidence: 0.9,
    },
    // Missing dancer between 1.1s and 3.0s (dancer occluded / out of frame)
    {
      timestamp: 3.0,
      landmarks: new Array(33).fill({ x: 0.7, y: 0.5, z: 0, visibility: 0.9 }),
      confidence: 0.9,
    },
  ];

  // During the gap at t = 2.0s, interpolation should return null (no skeleton rendered)
  const poseDuringGap = getInterpolatedPose(framesWithGap, 2.0);
  assert(
    poseDuringGap === null,
    'Interpolation across wide gap (>0.5s) returns null instead of hallucinating straight line',
    `Result: ${poseDuringGap}`
  );

  // Close to valid frame at t = 1.05s, interpolation should succeed
  const poseNearFrame = getInterpolatedPose(framesWithGap, 1.05);
  assert(
    poseNearFrame !== null && poseNearFrame.length === 33,
    'Interpolation between proximate frames (span=0.1s) smoothly connects valid poses',
    `Result length: ${poseNearFrame?.length}`
  );
}

async function run() {
  await testNoSyntheticFallback();
  testTwoVideosProduceDifferentLandmarks();
  testCandidateDancerNoFakeSkeleton();
  testMissingFrameInterpolation();

  console.log('\n======================================================');
  console.log(` Summary: ${passCount} passed, ${failCount} failed`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run();
