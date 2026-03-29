import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import HavokPhysics from "@babylonjs/havok";
import { Engine, HavokPlugin } from "@babylonjs/core";
import playgroundScene from "./Playground";
import earcut from "earcut";
import { registerBuiltInLoaders } from "@babylonjs/loaders";

async function getInitializedHavok() {
    return await HavokPhysics();
}

async function initializeHavok() {
    const havokInstance = await HavokPhysics();
    const havokPlugin = new HavokPlugin(true, havokInstance);
    return havokPlugin;
}

async function loadFonts() {
    var FontFaceObserver = require("fontfaceobserver");

    return await Promise.all([new FontFaceObserver("Mustica").load()]);
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

        registerBuiltInLoaders();

        // initialize babylon scene and engine
        var engine = new Engine(this.canvas, true);

        Promise.all([initializeHavok(), loadFonts()]).then(() => {});
        initializeHavok().then((havokPlugin) => {
            var scene = playgroundScene(engine, this.canvas, havokPlugin);

            // Show the inspector when pressing "i" or "I"
            window.addEventListener("keydown", (ev) => {
                if (ev.key === "i" || ev.key === "I") {
                    if (scene.debugLayer.isVisible()) {
                        scene.debugLayer.hide();
                    } else {
                        scene.debugLayer.show();
                    }
                }
            });

            // run the main render loop
            engine.runRenderLoop(() => {
                scene.render();
            });
        });
    }
}
new App();
