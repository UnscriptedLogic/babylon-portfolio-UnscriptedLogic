import {
  Color4,
  FragmentOutputBlock,
  InputBlock,
  NodeMaterial,
  NodeMaterialModes,
  NodeMaterialSystemValues,
  TransformBlock,
  VectorSplitterBlock,
  VertexOutputBlock,
} from "@babylonjs/core";

export function Mat_OverlapRegion() {
  var nodeMaterial = new NodeMaterial("OverlapRegionMaterial");
  nodeMaterial.mode = NodeMaterialModes.Material;

  // InputBlock
  var position = new InputBlock("position");
  position.visibleInInspector = false;
  position.visibleOnFrame = false;
  position.target = 1;
  position.setAsAttribute("position");

  // TransformBlock
  var WorldPos = new TransformBlock("WorldPos");
  WorldPos.visibleInInspector = false;
  WorldPos.visibleOnFrame = false;
  WorldPos.target = 1;
  WorldPos.complementZ = 0;
  WorldPos.complementW = 1;

  // InputBlock
  var World = new InputBlock("World");
  World.visibleInInspector = false;
  World.visibleOnFrame = false;
  World.target = 1;
  World.setAsSystemValue(NodeMaterialSystemValues.World);

  // TransformBlock
  var WorldPosViewProjectionTransform = new TransformBlock(
    "WorldPos * ViewProjectionTransform",
  );
  WorldPosViewProjectionTransform.visibleInInspector = false;
  WorldPosViewProjectionTransform.visibleOnFrame = false;
  WorldPosViewProjectionTransform.target = 1;
  WorldPosViewProjectionTransform.complementZ = 0;
  WorldPosViewProjectionTransform.complementW = 1;

  // InputBlock
  var ViewProjection = new InputBlock("ViewProjection");
  ViewProjection.visibleInInspector = false;
  ViewProjection.visibleOnFrame = false;
  ViewProjection.target = 1;
  ViewProjection.setAsSystemValue(NodeMaterialSystemValues.ViewProjection);

  // VertexOutputBlock
  var VertexOutput = new VertexOutputBlock("VertexOutput");
  VertexOutput.visibleInInspector = false;
  VertexOutput.visibleOnFrame = false;
  VertexOutput.target = 1;

  // InputBlock
  var color = new InputBlock("color");
  color.visibleInInspector = false;
  color.visibleOnFrame = false;
  color.target = 1;
  color.value = new Color4(1, 1, 1, 1);
  color.isConstant = false;

  // FragmentOutputBlock
  var FragmentOutput = new FragmentOutputBlock("FragmentOutput");
  FragmentOutput.visibleInInspector = false;
  FragmentOutput.visibleOnFrame = false;
  FragmentOutput.target = 2;
  FragmentOutput.convertToGammaSpace = false;
  FragmentOutput.convertToLinearSpace = false;
  FragmentOutput.useLogarithmicDepth = false;

  // VectorSplitterBlock
  var VectorSplitter = new VectorSplitterBlock("VectorSplitter");
  VectorSplitter.visibleInInspector = false;
  VectorSplitter.visibleOnFrame = false;
  VectorSplitter.target = 4;

  // InputBlock
  var uv = new InputBlock("uv");
  uv.visibleInInspector = false;
  uv.visibleOnFrame = false;
  uv.target = 1;
  uv.setAsAttribute("uv");

  // Connections
  position.output.connectTo(WorldPos.vector);
  World.output.connectTo(WorldPos.transform);
  WorldPos.output.connectTo(WorldPosViewProjectionTransform.vector);
  ViewProjection.output.connectTo(WorldPosViewProjectionTransform.transform);
  WorldPosViewProjectionTransform.output.connectTo(VertexOutput.vector);
  color.output.connectTo(FragmentOutput.rgba);
  uv.output.connectTo(VectorSplitter.xyIn);
  VectorSplitter.y.connectTo(FragmentOutput.a);

  // Output nodes
  nodeMaterial.addOutputNode(VertexOutput);
  nodeMaterial.addOutputNode(FragmentOutput);
  nodeMaterial.build();

  return nodeMaterial;
}
