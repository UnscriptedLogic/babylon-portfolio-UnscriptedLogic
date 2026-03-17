import {
  ActionManager,
  ExecuteCodeAction,
  Scalar,
  Scene,
} from "@babylonjs/core";

class PlayerInput {
  inputMap: {};
  vertical: any;
  verticalAxis: number;
  horizontal: any;
  horizontalAxis: number;

  constructor(scene: Scene) {
    scene.actionManager = scene.actionManager || new ActionManager(scene);

    this.inputMap = {};
    scene.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (e) => {
        this.inputMap[e.sourceEvent.key] = e.sourceEvent.type == "keydown";
      }),
    );

    scene.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (e) => {
        this.inputMap[e.sourceEvent.key] = e.sourceEvent.type == "keydown";
      }),
    );

    //This will make it so that input is updated before the scene is rendered, so that we can use it to move the player
    scene.onBeforeRenderObservable.add(() => {
      this._updateFromKeyboard();
    });
  }

  private _updateFromKeyboard(): void {
    if (this.inputMap["ArrowUp"]) {
      this.vertical = Scalar.Lerp(this.vertical, 1, 0.2);
      this.verticalAxis = 1;
    } else if (this.inputMap["ArrowDown"]) {
      this.vertical = Scalar.Lerp(this.vertical, -1, 0.2);
      this.verticalAxis = -1;
    } else {
      this.vertical = 0;
      this.verticalAxis = 0;
    }

    if (this.inputMap["ArrowLeft"]) {
      this.horizontal = Scalar.Lerp(this.horizontal, -1, 0.2);
      this.horizontalAxis = -1;
    } else if (this.inputMap["ArrowRight"]) {
      this.horizontal = Scalar.Lerp(this.horizontal, 1, 0.2);
      this.horizontalAxis = 1;
    } else {
      this.horizontal = 0;
      this.horizontalAxis = 0;
    }
  }
}

export { PlayerInput };
