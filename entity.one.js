//create entity module

//createNoColId
let noColId = "nCId913805264104";
  
//add touch module
let touch = await import("https://cdn.jsdelivr.net/gh/Lexyth/gesturejs/gesture.one.js")
  .then(module => module).catch(e => {console.error("Failed to load module: GestureJS"); throw "Failed to load module: GestureJS";});//using both cause throwing doesn't show the message here but it's needed to stop execution...

//add style to DOM
//TODO: deal with html and body differently
{
  let style = document.createElement("style");
  style.innerHTML = `.${noColId}game-view {
  flex: 1 0 auto;
  outline: 1px solid black;
}

*:has(> .${noColId}game-view) {
  display: flex;
  overflow: hidden;
}`;
  
  document.head.append(style);
}

//add canvas to DOM
let ctx = (function () {
  let canvas = document.createElement("canvas");
  canvas.className = `${noColId}game-view`;
  
  //TODO: figure out a way to make resizing reasonable when the canvas is appended to something other than window/body
  document.body.append(canvas);
  
  let ctx = canvas.getContext("2d");
  
  function resize () {
    ctx.canvas.setAttribute('width', window.innerWidth);
    ctx.canvas.setAttribute('height', window.innerHeight);
  }
  resize();
  window.addEventListener("resize", resize);
  
  return ctx;
})();

let gestures = touch.addEvents(ctx.canvas, "tap");

let utility = {
  rotate: function (cx, cy, x, y, angle) {
    let radians = (Math.PI / 180) * angle,
        cos = Math.cos(radians),
        sin = Math.sin(radians),
        nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
        ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
    return [nx, ny];
  }
}

let registeredEntities = {};

(function () {
  let runningId = 0;
  Object.defineProperties(
    registeredEntities, {
      register: {
        value: function (entity) {
          if (!registeredEntities[entity.layer])
            registeredEntities[entity.layer] = {};
          registeredEntities[entity.layer][runningId] = entity;
          entity.registeredId = runningId++;
        }
      },
      unregister: {
        value: function (entity) {
          delete registeredEntities[entity.layer][entity.registeredId];
          if (Object.keys(registeredEntities[entity.layer]).length == 0)
            delete registeredEntities[entity.layer];
        }
      }
    }
  );
})();

let frameCount = 0;
//loop
let loop = function (setupCallback, updateCallback) {
  
  //make this into a promise so draw only starts once everything is ready
  setupCallback();
  
  function draw () {
    frameCount++;
    
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    
    updateCallback();
    
    for (let layer of Object.keys(registeredEntities))
      for (let id of Object.keys(registeredEntities[layer]))
        registeredEntities[layer][id].draw(ctx);
    
    window.requestAnimationFrame(draw);
  }
  
  draw();
};

let Entity = (function () {
  class Entity {
    
    constructor (transform, image, layer) {
      this.position = {
        x: transform.pos?.x ?? 0,
        y: transform.pos?.y ?? 0
      };
      this.offset = {
        x: transform.offset?.x ?? 0,
        y: transform.offset?.y ?? 0
      };
      this.rotation = transform.rot ?? 0;
      
      this.size = {
        w: transform.size?.w ?? 10, 
        h: transform.size?.h ?? 10
      };
      
      this.image = image;
      
      this.layer = layer ?? 1000;
      
      this.show();
    }
    
    draw (ctx) {
      let pos = this.position,
          offset = this.offset,
          rot = this.rotation,
          size = this.size,
          image = this.image;
      
      ctx.translate(pos.x, pos.y);
      ctx.rotate(rot*Math.PI/180);
      
      if (this.image)
        ctx.drawImage(image, offset.x, offset.y, size.w, size.h);
      else
        ctx.strokeRect(offset.x, offset.y, size.w, size.h);
      
      ctx.rotate(-rot*Math.PI/180);
      ctx.translate(-pos.x, -pos.y);
    }
      
    get image () {
      return this._image;l
    }
    
    get position () {
      return this._position;
    }
    
    get rotation () {
      return this._rotation;
    }
    
    get size () {
      return this._size;
    }
    
    get visible () {
      return this._visible;
    }
    
    hide () {
      this._visible = false;
      registeredEntities.unregister(this);
    }
    
    move (x, y) {
      this.position = [this.position.x + x, this.position.y + y];
    }

    rotate (deg) {
      this.rotation = this.rotation + deg; //just let smartipants' pass more than Max_integer-359 if they want
    }
    
    scale (sw, sh) {
      this.size = {
        w: this.size.w * sw, 
        h: this.size.h * sh
      };
    }
    
    set image (image) {
      if (typeof image === "string") {
        let img = new Image();
        img.onload = () => {
          this.image = img;
        }
        img.src = image;
      } else
        this._image = image;
    }
    
    set position (pos) {
      if (Array.isArray(pos))
        pos = {
          x: pos[0],
          y: pos[1]
        };
      this._position = pos;
    }
    
    set rotation (deg) {
      this._rotation = Math.abs(deg%360);
    }
    
    set size (size) {
      if (Array.isArray(size))
        size = {
          w: size[0],
          h: size[1]
        };
      this._size = {
        w: size.w > 1 ? size.w : 1,
        h: size.h > 1 ? size.h : 1
      };
    }
    
    set visible (visible) {
      if (visible)
        this.show();
      else
        this.hide();
    }
    
    show () {
      this._visible = true;
      registeredEntities.register(this);
    }
  }
  
  return Entity;
})();

let modifiers = {
  //simple hitbox
  hitable: function (entity) {
    let hitbox = {};
    Object.defineProperties(hitbox, {
      left: {
        get () {
          return entity.position.x + entity.offset.x;
        }
      },
      top: {
        get () {
          return entity.position.y + entity.offset.y;
        }
      },
      right: {
        get () {
          return this.left + entity.size.w;
        }
      },
      bottom: {
        get () {
          return this.top + entity.size.h;
        }
      }
    });
    let hitable = {};
    Object.defineProperties(hitable, {
      hitbox: {
        value: hitbox
      },
      isHit: {
        value: function (x, y) {
          if (this.hitbox.left < x && x < this.hitbox.right && this.hitbox.top < y && y < this.hitbox.bottom)
            return true;
          return false;
        }
      },
      onHit: {
        value: function (x, y) {
          console.log(`hit at ${x}, ${y}`)
        }
      }
    });
    Object.defineProperty(entity, "hitable", {value: hitable});
    let tapListener = gestures.tap.addListener(function () {
      if (!entity.visible)
        return;
      let pos = Object.values(arguments[0])[0].initialPosition;
      let entX = entity.position.x,
          entY = entity.position.y,
          hitL = hitable.hitbox.left,
          hitT = hitable.hitbox.top,
          rot = entity.rotation;
      let rotated = utility.rotate(entX, entY, pos.x, pos.y, rot);

      if (hitable.isHit(...rotated))
        hitable.onHit(parseInt(rotated[0]-hitL), parseInt(rotated[1]-hitT));
    }, entity.layer);
    return entity;
  }
};

export {ctx, loop, Entity, modifiers, frameCount};
