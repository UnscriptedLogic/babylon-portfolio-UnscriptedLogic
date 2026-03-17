import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import HavokPhysics from "@babylonjs/havok";
import {
  Engine,
  HavokPlugin,
} from "@babylonjs/core";
import playgroundScene from "./Playground";

async function getInitializedHavok() {
  return await HavokPhysics();
}

async function initializeHavok() {
  const havokInstance = await HavokPhysics();
  const havokPlugin = new HavokPlugin(true, havokInstance);
  return havokPlugin;
}

class App {
  IsPointerDown: boolean;
  canvas: HTMLCanvasElement;
  constructor() {
    // create the canvas html element and attach it to the webpage
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.id = "gameCanvas";
    document.body.appendChild(this.canvas);

    // initialize babylon scene and engine
    var engine = new Engine(this.canvas, true);
    initializeHavok().then((havokPlugin) => {
      var scene = playgroundScene(engine, this.canvas, havokPlugin);

      // run the main render loop
      engine.runRenderLoop(() => {
        scene.render();
      });
    })
  }
}
new App();
