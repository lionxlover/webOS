/* Colour maths: HSL <-> hex and harmony generators. */
(function(){
'use strict';
function hsl2hex(h,s,l){h=((h%360)+360)%360;s/=100;l/=100;var a=s*Math.min(l,1-l),f=function(n){var k=(n+h/30)%12,c=l-a*Math.max(-1,Math.min(k-3,9-k,1));return Math.round(255*c).toString(16).padStart(2,'0')};return '#'+f(0)+f(8)+f(4)}
function hex2hsl(hex){var r=parseInt(hex.substr(1,2),16)/255,g=parseInt(hex.substr(3,2),16)/255,b=parseInt(hex.substr(5,2),16)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,h=0,s=0,d=mx-mn;
 if(d){s=d/(1-Math.abs(2*l-1));h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60}return[(h+360)%360,s*100,l*100]}
function lum(hex){var c=[1,3,5].map(function(i){var v=parseInt(hex.substr(i,2),16)/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]}
function jit(n){return(Math.random()-.5)*n}
window.Color={hsl2hex:hsl2hex,hex2hsl:hex2hsl,
 textOn:function(hex){return lum(hex)>.4?'#10131c':'#ffffff'},
 harmony:function(mode,base){var c=hex2hsl(base),h=c[0],s=c[1],l=c[2],o=[];
  if(mode==='random'){var h0=Math.random()*360;for(var i=0;i<5;i++)o.push(hsl2hex(h0+i*(40+Math.random()*50),45+Math.random()*45,38+Math.random()*34));return o}
  var hs=mode==='analogous'?[-40,-20,0,20,40]:mode==='complementary'?[0,0,180,180,0]:mode==='triadic'?[0,120,240,0,120]:mode==='split'?[0,150,210,0,150]:[0,0,0,0,0];
  for(var j=0;j<5;j++){var L=mode==='mono'?18+j*16:Math.max(22,Math.min(82,l+(j-2)*9+jit(6)));o.push(hsl2hex(h+hs[j],Math.max(25,Math.min(95,s+jit(10))),L))}return o}};
})();
