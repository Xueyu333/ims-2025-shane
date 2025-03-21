//https://openprocessing.org/sketch/2018248
//I found this interesting camera effect on OpenProcessing—it creates a 3D-like visual experience simply by using particles and fade effects. It's very amazing!


let cam;
ns = 60; //noise scale for particle position
nss = 150; //noise scale for time/animation
ni = 8; // Noise intensity factor

function setup() {
  cam = createCapture(VIDEO); //Initialize the webcam
  cam.hide(); //Hide the default video element

  canvasElement = createCanvas(windowWidth, windowHeight);

  background(0); //set initial background to black
}

//variables for pixel color and position calculations
let i, r, g, b;

//process webcam feed and create the particle effect
function draw() {
  background(0, 25); //create fade effect with semi-transparent black background

  //initialize width/height once webcam is ready
  if (cam.width > 0) {
    w = cam.width;
    h = cam.height;
  }

  //Set different parameters based on webcam orientation
  if (w > h) {
    // Landscape orientation settings
    sz = 5; // Particle size
    space = 1; // Space between particles
    walk = 30; // Maximum orbital movement distance
    spd = 35; // Orbital movement speed
  } else {
    // Portrait orientation settings
    sz = 5;
    space = 5;
    walk = 15;
    spd = 5;
  }

  //Create a graphics buffer for the particle effect, it's a bit smaller than the camera's native size. This is because the particles are moving in orbit (controlled by the walk parameter) and need to have margins to prevent them from moving out of view.
  bg = createGraphics(w - walk * 2, h - walk * 2);

  bg.noStroke(); // Draw particles without outlines

  // Calculate scaling to fit the webcam feed to the canvas while preserving aspect ratio
  if (width / height >= w / h) {
    // if window is wider than the video

    nW = width; // Scale video width to window width
    nH = width / (w / h); // Calculate proportional height
    oX = 0; // No horizontal offset（The image is aligned to the left, no horizontal offset is required）
    oY = (height - nH) / 2; // Center vertically（The image is centered vertically with equal margins on the top and bottom）
  } else {
    // if window is taller than the video

    nW = height * (w / h); // Calculate proportional width
    nH = height; // Scale video height to window height
    oX = (width - nW) / 2; // Center horizontally（The image is centered horizontally with equal margins on the left and right）
    oY = 0; // No vertical offset（The image is aligned to the top, no vertical offset is required）
  }

  // Access webcam pixel data
  cam.loadPixels();

  // Iterate through webcam pixels at regular intervals，start to draw particles
  for (let x = 0; x < w; x += sz + space) {
    for (let y = 0; y < h; y += sz + space) {
      // Calculate the pixel index in the pixels array (4 values per pixel: R,G,B,A)
      i = (y * w + x) * 4;

      // Get the RGB values for the current pixel
      r = cam.pixels[i];
      g = cam.pixels[i + 1];
      b = cam.pixels[i + 2];

      // Set the fill color for the particle
      bg.fill(r, g, b);

      // Calculate orbital movement patterns
      orbitX = sin(frameCount / spd) * walk; //Control the movement speed (the larger the spd, the slower the movement)
      orbitY = cos(frameCount / spd) * walk;

      
      
      // Add perlin noise to create organic movement
      // nx and ny are "noise multipliers" that are used to add organic variations to the particle's orbital motion.

      //Spatial noise:
      // noise(x / ns, y / ns) creates noise values based on the particle's position
      // ns (noise scaling factor) equals 60 to make the noise change more gradually
      // Particles in the same area will get similar noise values

      
      // Time noise:
      // noise(frameCount / nss) creates time-varying noise based on the current frame count
      // nss is equal to 150, which controls the speed of time changes
      // This value will change slowly as the animation progresses
      
      nx = noise(x / ns, y / ns) * noise(frameCount / nss) * ni;
      ny = noise(y / ns, x / ns) * noise(frameCount / nss) * ni;

      //The values of nx and ny will fluctuate between 0 and 1, but because they are multiplied by ni(8), the actual range is approximately 0 to 8.
      
//Why the order of x and y is swapped？
// Use noise(x / ns, y / ns) in nx
// Use noise(y / ns, x / ns) in ny
// This is done to make the noise in the x and y directions not completely correlated, creating a more natural movement
      
      
      
      // Draw the particle (ellipse) with calculated position and size
      bg.ellipse(x - walk + orbitX * nx, y - walk + orbitY * ny, sz, sz);
      
// 01：Base position adjustment:
// (x - walk) and (y - walk) are the adjusted base positions
// Walk is subtracted to leave space at the edges to prevent particles from moving out of view

// 02:Orbital motion + noise:
// orbitX * nx multiplies the x component of the circular orbit by the noise multiplier
// orbitY * ny multiplies the y component of the circular orbit by the noise multiplier
// This way, each particle's orbit is no longer a perfect circle, but a slightly deformed path

//03Final position:
// x coordinate = (x - walk) + (orbitX * nx)
// y coordinate = (y - walk) + (orbitY * ny)

// Without noise (nx and ny are both equal to 1), particles move along perfectly circular orbits. But with noise, each particle's trajectory has a unique deformation, and this deformation changes smoothly over time, creating an organic, flowing visual effect.
//nx and ny control the "irregularity" of each particle's orbital motion
      
      
    }
  }

  
  //Creates a mirror effect, flipping the camera feed horizontally so it's like you're looking at yourself in a mirror.
  // Begin a transformation state
  push();
  translate(width, 0); // Move to the right edge of the canvas
  scale(-1, 1); // Flip horizontally (mirror effect)
  image(bg, oX, oY, nW, nH); // Draw the effect buffer to the canvas
  pop(); // End the transformation state
}

function windowResized() {
  canvasElement = createCanvas(windowWidth, windowHeight);
}

// toggle fullscreen mode when the canvas is clicked
function mousePressed() {
  if (
    mouseX > 0 &&
    mouseX < windowWidth &&
    mouseY > 0 &&
    mouseY < windowHeight
  ) {
    let fs = fullscreen();
    fullscreen(!fs);
  }
}
