const video=document.getElementById("webcam")
const canvas=document.getElementById("canvas")
const ctx=canvas.getContext("2d")

canvas.width=700
canvas.height=520

const overlay=document.getElementById("overlay")
const progress=document.getElementById("progress")
const scoreText=document.getElementById("score")

const HOLD_TIME=3000

let level=1
let state="setup"
let holdStart=0

const LM={
NOSE:0,
L_SHOULDER:11,
R_SHOULDER:12,
L_WRIST:15,
R_WRIST:16,
L_HIP:23,
R_HIP:24,
L_KNEE:25,
R_KNEE:26,
L_ANKLE:27,
R_ANKLE:28
}

function dist(a,b){
return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2)
}

function angle(A,B,C){
const r=Math.atan2(C.y-B.y,C.x-B.x)-Math.atan2(A.y-B.y,A.x-B.x)
let a=Math.abs(r*180/Math.PI)
if(a>180)a=360-a
return a
}

function speak(t){
const u=new SpeechSynthesisUtterance(t)
speechSynthesis.speak(u)
}

function checkTreePose(lm){

let leftFoot=lm[LM.L_ANKLE]
let rightFoot=lm[LM.R_ANKLE]
let rightKnee=lm[LM.R_KNEE]
let leftHip=lm[LM.L_HIP]
let rightHip=lm[LM.R_HIP]

let leftShoulder=lm[LM.L_SHOULDER]
let rightShoulder=lm[LM.R_SHOULDER]
let nose=lm[LM.NOSE]

/* FOOT POSITIONS */

let leftFootGrounded=leftFoot.y>0.75

let footNearAnkle=dist(leftFoot,rightFoot)<0.07

let footOnCalf=
dist(rightFoot,lm[LM.L_KNEE])<0.15

let footOnThigh=
dist(rightFoot,leftHip)<0.20

/* KNEE ROTATION */

let kneeOut=angle(rightHip,rightKnee,rightFoot)>40

/* HAND POSITIONS */

let handsOnHips=
dist(lm[LM.L_WRIST],leftHip)<0.15 &&
dist(lm[LM.R_WRIST],rightHip)<0.15

let armsUp=
lm[LM.L_WRIST].y < lm[LM.L_SHOULDER].y &&
lm[LM.R_WRIST].y < lm[LM.R_SHOULDER].y

/* POSTURE CHECKS */

let spineStraight=
Math.abs(nose.x-leftHip.x)<0.15

let hipsForward=
Math.abs(leftHip.x-rightHip.x)>0.15

let shouldersRelaxed=
leftShoulder.y>nose.y &&
rightShoulder.y>nose.y

return{
leftFootGrounded,
footNearAnkle,
footOnCalf,
footOnThigh,
kneeOut,
handsOnHips,
armsUp,
spineStraight,
hipsForward,
shouldersRelaxed
}

}

function coach(lm){

const r=checkTreePose(lm)

progress.innerText="Level "+level+" / 3"

/* POSTURE CORRECTIONS */

if(!r.spineStraight){
overlay.innerText="Stand taller"
return
}

if(!r.hipsForward){
overlay.innerText="Face hips forward"
return
}

if(!r.shouldersRelaxed){
overlay.innerText="Relax your shoulders"
return
}

/* MAIN STATE MACHINE */

if(state==="setup"){

overlay.innerText="Shift weight to LEFT foot"

if(r.leftFootGrounded){
state="foot"
speak("Good. Lift your right foot.")
}

}

else if(state==="foot"){

if(level===1){
overlay.innerText="Place foot on ankle"
if(r.footNearAnkle){
state="knee"
speak("Rotate your knee outward.")
}
}

if(level===2){
overlay.innerText="Place foot on calf"
if(r.footOnCalf){
state="knee"
speak("Rotate your knee outward.")
}
}

if(level===3){
overlay.innerText="Place foot on thigh"
if(r.footOnThigh){
state="knee"
speak("Rotate your knee outward.")
}
}

}

else if(state==="knee"){

overlay.innerText="Rotate knee outward"

if(r.kneeOut){

if(level===3){
state="arms"
speak("Raise your arms above your head.")
}
else{
state="hands"
speak("Place your hands on your hips.")
}

}

}

else if(state==="hands"){

overlay.innerText="Hands on hips"

if(r.handsOnHips){
state="hold"
holdStart=Date.now()
speak("Perfect. Hold the pose.")
}

}

else if(state==="arms"){

overlay.innerText="Raise arms up"

if(r.armsUp){
state="hold"
holdStart=Date.now()
speak("Perfect. Hold the pose.")
}

}

else if(state==="hold"){

let elapsed=Date.now()-holdStart
let remain=Math.ceil((HOLD_TIME-elapsed)/1000)

overlay.innerText="Hold... "+remain

if(elapsed>HOLD_TIME){

if(level<3){

level++
state="setup"
speak("Great. Moving to the next level.")

}
else{

state="done"
scoreText.innerText="All Levels Completed!"
speak("Excellent tree pose. Session complete.")

}

}

}

}

function onResults(results){

ctx.clearRect(0,0,canvas.width,canvas.height)
ctx.drawImage(results.image,0,0,canvas.width,canvas.height)

if(results.poseLandmarks){

drawConnectors(ctx,results.poseLandmarks,POSE_CONNECTIONS)
drawLandmarks(ctx,results.poseLandmarks)

coach(results.poseLandmarks)

}

}

const pose=new Pose({
locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
})

pose.setOptions({
modelComplexity:1,
smoothLandmarks:true,
minDetectionConfidence:0.5,
minTrackingConfidence:0.5
})

pose.onResults(onResults)

const camera=new Camera(video,{
onFrame:async()=>{
await pose.send({image:video})
},
width:1280,
height:720
})

camera.start()