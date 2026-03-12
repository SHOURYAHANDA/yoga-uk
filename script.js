// global error handler (show actual message on overlay to aid debugging)
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global error:", message, "at", source + ":["+lineno+":"+colno+"]", error);
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.innerText = message || "Error occurred - see console";
};

window.addEventListener('load', () => {
  console.log("Page loaded, initializing app...");
  initializeApp();
});

async function initializeApp() {
  const video = document.getElementById("webcam");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  if (!video || !canvas || !ctx) {
    console.error("❌ Cannot find video, canvas, or context");
    return;
  }

  console.log("Initializing app...");

  canvas.width = 700;
  canvas.height = 520;

  const overlay = document.getElementById("overlay");
  const progress = document.getElementById("progress");
  const scoreText = document.getElementById("score");

  const HOLD_TIME = 3000;
  let level = 1;
  let state = "setup";
  let holdStart = 0;

  const LM = {
    NOSE: 0, L_SHOULDER: 11, R_SHOULDER: 12,
    L_WRIST: 15, R_WRIST: 16, L_HIP: 23, R_HIP: 24,
    L_KNEE: 25, R_KNEE: 26, L_ANKLE: 27, R_ANKLE: 28
  };

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function angle(A, B, C) {
    let r = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let a = Math.abs(r * 180 / Math.PI);
    return a > 180 ? 360 - a : a;
  }

  function speak(t) {
    try {
      speechSynthesis.speak(new SpeechSynthesisUtterance(t));
    } catch (e) {
      console.log("Speech error:", e);
    }
  }

  function checkTreePose(lm) {
    if (!lm || lm.length < 29) return {};

    let leftFoot = lm[LM.L_ANKLE];
    let rightFoot = lm[LM.R_ANKLE];
    let rightKnee = lm[LM.R_KNEE];
    let leftHip = lm[LM.L_HIP];
    let rightHip = lm[LM.R_HIP];
    let leftShoulder = lm[LM.L_SHOULDER];
    let rightShoulder = lm[LM.R_SHOULDER];
    let nose = lm[LM.NOSE];

    return {
      leftFootGrounded: leftFoot.y > 0.75,
      footNearAnkle: dist(leftFoot, rightFoot) < 0.07,
      footOnCalf: dist(rightFoot, lm[LM.L_KNEE]) < 0.15,
      footOnThigh: dist(rightFoot, leftHip) < 0.2,
      kneeOut: angle(rightHip, rightKnee, rightFoot) > 40,
      handsOnHips: dist(lm[LM.L_WRIST], leftHip) < 0.15 && dist(lm[LM.R_WRIST], rightHip) < 0.15,
      armsUp: lm[LM.L_WRIST].y < lm[LM.L_SHOULDER].y && lm[LM.R_WRIST].y < lm[LM.R_SHOULDER].y,
      spineStraight: Math.abs(nose.x - leftHip.x) < 0.15,
      hipsForward: Math.abs(leftHip.x - rightHip.x) > 0.15,
      shouldersRelaxed: leftShoulder.y > nose.y && rightShoulder.y > nose.y
    };
  }

  function coach(lm) {
    const r = checkTreePose(lm);
    progress.innerText = "Level " + level + " / 3";

    if (!r.spineStraight) {
      overlay.innerText = "Stand taller";
      return;
    }
    if (!r.hipsForward) {
      overlay.innerText = "Face hips forward";
      return;
    }
    if (!r.shouldersRelaxed) {
      overlay.innerText = "Relax your shoulders";
      return;
    }

    if (state === "setup") {
      if (r.leftFootGrounded) {
        state = "foot";
        speak("Good. Lift your right foot.");
      }
      overlay.innerText = "Shift weight to LEFT foot";
    } else if (state === "foot") {
      if (level === 1 && r.footNearAnkle) {
        state = "knee";
        speak("Rotate your knee outward.");
        overlay.innerText = "Place foot on ankle";
      } else if (level === 2 && r.footOnCalf) {
        state = "knee";
        speak("Rotate your knee outward.");
        overlay.innerText = "Place foot on calf";
      } else if (level === 3 && r.footOnThigh) {
        state = "knee";
        speak("Rotate your knee outward.");
        overlay.innerText = "Place foot on thigh";
      }
    } else if (state === "knee") {
      if (r.kneeOut) {
        state = level === 3 ? "arms" : "hands";
        speak(level === 3 ? "Raise your arms above your head." : "Place your hands on your hips.");
        overlay.innerText = "Rotate knee outward";
      }
    } else if (state === "hands") {
      if (r.handsOnHips) {
        state = "hold";
        holdStart = Date.now();
        speak("Perfect. Hold the pose.");
        overlay.innerText = "Hands on hips";
      }
    } else if (state === "arms") {
      if (r.armsUp) {
        state = "hold";
        holdStart = Date.now();
        speak("Perfect. Hold the pose.");
        overlay.innerText = "Raise arms up";
      }
    } else if (state === "hold") {
      let elapsed = Date.now() - holdStart;
      let remain = Math.ceil((HOLD_TIME - elapsed) / 1000);
      overlay.innerText = "Hold... " + remain;
      if (elapsed > HOLD_TIME) {
        if (level < 3) {
          level++;
          state = "setup";
          speak("Great. Moving to the next level.");
        } else {
          state = "done";
          scoreText.innerText = "All Levels Completed!";
          speak("Excellent tree pose. Session complete.");
        }
      }
    }
  }

  function drawPose(landmarks) {
    if (!landmarks || landmarks.length === 0) return;

    // Pose connections
    const connections = [
      [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
      [24, 26], [26, 28]
    ];

    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;

    connections.forEach(([start, end]) => {
      if (landmarks[start] && landmarks[end]) {
        const p1 = landmarks[start];
        const p2 = landmarks[end];
        ctx.beginPath();
        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
      }
    });

    // Draw landmarks
    ctx.fillStyle = "#FF0000";
    landmarks.forEach(landmark => {
      if (landmark && landmark.x && landmark.y) {
        ctx.beginPath();
        ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }

  function onResults(results) {
    // DEBUG: log when results arrive (length may be undefined)
    console.log("onResults called", results && results.poseLandmarks && results.poseLandmarks.length);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.image) {
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    }

    if (results.poseLandmarks && results.poseLandmarks.length > 0) {
      console.log("🟢 Drawing " + results.poseLandmarks.length + " landmarks");
      drawPose(results.poseLandmarks);
      coach(results.poseLandmarks);
    } else {
      // no landmarks (could be detection failure); log for insight
      console.log("⚠️ no poseLandmarks in results", results);
      overlay.innerText = "No pose detected – try a clearer video or different lighting";
    }
  }

  if (typeof Pose === 'undefined') {
    console.error("Pose library not loaded");
    overlay.innerText = "Pose library failed to load – check network or download libs into /libs";
    return;
  }

  // choose whether to load asset files from local `libs/` or fallback to CDN
  let baseUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/';
  try {
    const resp = await fetch('libs/pose_solution_packed_assets.data', { method: 'HEAD' });
    if (resp.ok) {
      console.log('Using local MediaPipe assets from libs/');
      baseUrl = 'libs/';
    }
  } catch (e) {
    console.log('Local assets not available, using CDN');
  }

  // if we're relying on the CDN, test the data file so we can give a better error
  if (baseUrl.startsWith('http')) {
    try {
      const check = await fetch(baseUrl + 'pose_solution_packed_assets.data', { method: 'HEAD' });
      if (!check.ok) throw new Error('bad response ' + check.status);
    } catch (err) {
      console.error('Failed to fetch MediaPipe data file from CDN', err);
      overlay.innerText = "Cannot load MediaPipe assets from CDN – network may be blocked.\n" +
                        "Download the files listed in the comments and place them in a /libs folder.";
      return; // stop initialization
    }
  }

  const pose = new Pose({
    locateFile: (file) => baseUrl + file
  });
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  pose.onResults(onResults);
  console.log("✓ Pose initialized");

  function startVideo(file) {
    video.crossOrigin = "anonymous";           // help avoid CORS problems with pose.send
    video.src = URL.createObjectURL(file);
    video.muted = true;

    video.onloadedmetadata = () => {
      console.log("✓ Video loaded");
      overlay.innerText = "Detecting pose...";
      video.play().catch((err) => {
        console.log("Play error:", err);
        overlay.innerText = "Error playing video";
      });
    };

    video.onerror = () => {
      console.log("Video error:", video.error);
      overlay.innerText = "Error loading video";
    };
  }

  function loadDefaultVideo() {
    fetch("tree.mp4")
      .then((res) => res.blob())
      .then((blob) => {
        console.log("✓ Default video loaded");
        startVideo(blob);
      })
      .catch((err) => {
        console.log("Default video not found");
        overlay.innerText = "Upload a video to start";
      });
  }

  const upload = document.getElementById("upload");
  upload.addEventListener("change", (e) => {
    if (e.target.files[0]) {
      console.log("📁 File selected:", e.target.files[0].name);
      startVideo(e.target.files[0]);
    }
  });

  overlay.innerText = "Ready - Upload video or use default";

  function processVideo() {
    if (!video.paused && !video.ended) {
      try {
        pose.send({ image: video });
      } catch (err) {
        console.log("Pose error:", err);
      }
    }

    if (!video.ended) {
      requestAnimationFrame(processVideo);
    }
  }

  processVideo();
  
  // Try to load default video
  loadDefaultVideo();
}

