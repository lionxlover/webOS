/* LionApps runner: load any .js file (from disk or the virtual FS) and run it in a sandboxed window.
   The script gets <div id="app-root"> and DOMContentLoaded, exactly like the standalone LionApps Launcher. */
(function(){'use strict';
  function frameDoc(name, code){
    var safe = code.replace(/<\/script/gi,'<\\/script');
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<title>'+LX.escape(name)+'</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:20px;background:#f4f4f9;color:#333}'+
      '#app-root{background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.08);min-height:calc(100vh - 100px)}</style></head><body>'+
      '<div id="app-root"><h3 style="color:gray">Running '+LX.escape(name)+'...</h3></div><script>window.addEventListener("error",function(e){var r=document.getElementById("app-root");'+
      'r.innerHTML="<pre style=\\"color:#c0392b;white-space:pre-wrap\\">"+String(e.message).replace(/</g,"&lt;")+"</pre>"});<\/script>'+
      '<script>'+safe+'<\/script></body></html>';
  }
  LX.apps.register({
    id:'lionapps', name:'LionApps', icon:'package', color:'#FF9A9E', category:'Developer',
    desc:'Run any .js file as an app', width:880, height:620, minWidth:420, minHeight:320,
    open:function(win,args){
      var cur=null;
      var title=LX.h('div',{class:'la-title muted ellipsis',text:'No app loaded'});
      var stage=LX.h('div',{class:'la-stage'});
      var file=LX.h('input',{type:'file',accept:'.js',hidden:true});
      function run(name,code){
        stage.innerHTML='';cur={name:name,code:code};title.textContent=name;win.setTitle(name+' — LionApps');
        var f=LX.h('iframe',{class:'la-frame',sandbox:'allow-scripts allow-modals allow-forms allow-popups'});
        f.srcdoc=frameDoc(name,code);stage.appendChild(f);
      }
      function welcome(){stage.innerHTML='';stage.appendChild(LX.h('div',{class:'la-welcome'},
        LX.h('div',{class:'la-icon',html:LX.icon('package',40)}),LX.h('h2',{text:'🦁 LionApps'}),
        LX.h('p',{class:'muted',text:'Upload any .js file — it runs inside this window with a #app-root container.'}),
        LX.h('div',{class:'row gap'},
          LX.h('button',{class:'btn primary',onclick:function(){file.click();}},'Select JS file'),
          LX.h('button',{class:'btn',onclick:openVfs},'Open from Files…'),
          LX.h('button',{class:'btn ghost',onclick:sample},'Run sample'))));}
      function openVfs(){LX.dialog.openFile({title:'Open LionApp',path:LX.vfs.HOME,exts:['js']}).then(function(p){if(p)run(LX.vfs.basename(p),LX.vfs.read(p));});}
      function sample(){run('sample.js','document.addEventListener("DOMContentLoaded",function(){var r=document.getElementById("app-root");r.innerHTML=\'<h1 style="color:#ff6b81">🦁 Welcome to your LionApp!</h1><p>Running in an isolated frame.</p><button id="b" style="background:#1e1e2f;color:#fff;border:0;padding:12px 24px;border-radius:8px;cursor:pointer">Click to test</button>\';document.getElementById("b").onclick=function(){alert("It works!")}});');}
      file.onchange=function(){var f=file.files[0];if(!f)return;if(!/\.js$/i.test(f.name)){LX.notify({title:'LionApps',body:'Please select a .js file'});return;}
        var r=new FileReader();r.onload=function(e){run(f.name,e.target.result);};r.readAsText(f);file.value='';};
      win.body.append(LX.h('div',{class:'toolbar'},
        LX.h('button',{class:'btn sm',onclick:function(){file.click();}},LX.h('span',{html:LX.icon('upload',14)}),'Upload'),
        LX.h('button',{class:'btn sm',onclick:openVfs},LX.h('span',{html:LX.icon('folder',14)}),'Files'),
        LX.h('button',{class:'btn sm',onclick:function(){if(cur)run(cur.name,cur.code);}},LX.h('span',{html:LX.icon('refresh',14)}),'Reload'),
        LX.h('button',{class:'btn sm',onclick:function(){if(cur&&LX.vfs.exists(LX.vfs.join(LX.vfs.HOME,'Documents')))
          LX.dialog.saveFile({title:'Save app',path:LX.vfs.HOME+'/Documents',name:cur.name}).then(function(p){if(p){LX.vfs.write(p,cur.code,{mime:'text/javascript'});LX.notify({title:'Saved',body:p});}});}},LX.h('span',{html:LX.icon('save',14)}),'Save to Files'),
        title),stage,file);
      win.body.addEventListener('dragover',function(e){e.preventDefault();});
      win.body.addEventListener('drop',function(e){e.preventDefault();var f=e.dataTransfer.files[0];if(f&&/\.js$/i.test(f.name)){var r=new FileReader();r.onload=function(ev){run(f.name,ev.target.result);};r.readAsText(f);}});
      if(args&&args.path){try{run(LX.vfs.basename(args.path),LX.vfs.read(args.path));}catch(e){welcome();}}else welcome();
    }
  });
  LX.apps.setOpener&&LX.apps.setOpener(['lapp'],'lionapps');
})();
