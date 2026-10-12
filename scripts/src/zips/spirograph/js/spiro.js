/* Hypotrochoid maths — pure functions, no DOM. */
(function(){
'use strict';
function gcd(a,b){return b?gcd(b,a%b):a}
window.Spiro={
  /* closed hypotrochoid: x=(R-r)cos t + d cos((R-r)/r t) ; y=(R-r)sin t - d sin((R-r)/r t) */
  turns:function(R,r){return r/gcd(Math.round(R),Math.round(r))},
  point:function(R,r,d,t){var k=(R-r)/r;return[(R-r)*Math.cos(t)+d*Math.cos(k*t),(R-r)*Math.sin(t)-d*Math.sin(k*t)]}
};
})();
