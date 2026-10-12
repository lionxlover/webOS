/* Seed bookmarks + persistent storage (localStorage with in-memory fallback). */
(function(){
'use strict';
var KEY='bookmarks.v1',mem=null,SEED=[
 {id:'s1',title:'MDN Web Docs',url:'https://developer.mozilla.org',tags:['dev','docs'],v:0},
 {id:'s2',title:'Wikipedia',url:'https://wikipedia.org',tags:['reference'],v:0},
 {id:'s3',title:'Hacker News',url:'https://news.ycombinator.com',tags:['news','dev'],v:0},
 {id:'s4',title:'OpenStreetMap',url:'https://openstreetmap.org',tags:['maps'],v:0}];
function load(){if(mem)return mem;try{var s=localStorage.getItem(KEY);mem=s?JSON.parse(s):SEED.map(function(x){return Object.assign({t:Date.now()},x)})}catch(e){mem=SEED.slice()}return mem}
function save(){try{localStorage.setItem(KEY,JSON.stringify(mem))}catch(e){}}
window.BM={all:load,save:save,
 add:function(url,title,tags){if(!/^[a-z]+:\/\//i.test(url))url='https://'+url;var b={id:'b'+Date.now().toString(36),url:url,title:title||url.replace(/^[a-z]+:\/\/(www\.)?/i,'').split('/')[0],tags:tags,v:0,t:Date.now()};load().unshift(b);save();return b},
 remove:function(id){mem=load().filter(function(b){return b.id!==id});save()},
 replace:function(list){mem=list;save()}};
})();
