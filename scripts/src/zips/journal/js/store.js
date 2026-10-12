/* Storage layer: localStorage when available (multi-file apps are same-origin), memory fallback otherwise. */
(function(){
'use strict';
var KEY='journal.entries.v1',mem=null;
function load(){if(mem)return mem;try{mem=JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){mem=[]}return mem}
function save(){try{localStorage.setItem(KEY,JSON.stringify(mem));return true}catch(e){return false}}
window.JStore={
  all:function(){return load().slice().sort(function(a,b){return b.date.localeCompare(a.date)||b.t-a.t})},
  get:function(id){return load().filter(function(e){return e.id===id})[0]},
  add:function(date){var e={id:'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),date:date,title:'',body:'',mood:'',t:Date.now()};load().push(e);save();return e},
  update:function(id,patch){var e=this.get(id);if(!e)return false;for(var k in patch)e[k]=patch[k];e.t=Date.now();return save()},
  remove:function(id){mem=load().filter(function(e){return e.id!==id});save()}
};
})();
