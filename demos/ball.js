var ctx = this.getContext("2d")

function ellipse(x, y, r1, r2) {
  ctx.beginPath();
  ctx.fillStyle = 'rgba(0,100,0,0.5)';
  ctx.ellipse(x, y, r1, r2, 0, 0, 4*Math.PI, true); 
  ctx.stroke();
}



// ellipse(50,100,10,10)

// ball animation from Victor2012
var x = 0, y = 50, dy = 0;

function draw() {
	x += 4
  	y += dy
  	if (y > 185) {
      dy = - dy
    } else {
      dy = dy * 0.98 + 3
    }
  	ellipse(x,y,30,30)
}

// meta-level begins here
function clear() {
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(0, 0, 300, 300);
}

var i = 0
function animate() {
 if (i++ < 100) {
	clear() // meta  	
	draw()
	setTimeout(animate, 1)
 }
} 


animate()