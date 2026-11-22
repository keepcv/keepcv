import { Composition, registerRoot } from "remotion";
import { Film } from "./film.jsx";

const Root = () => (
  <>
    <Composition
      id="KeepCV90"
      component={Film}
      durationInFrames={2700}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ cut: "short", music: true }}
    />
    <Composition
      id="KeepCV180"
      component={Film}
      durationInFrames={5400}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ cut: "long", music: true }}
    />
  </>
);
registerRoot(Root);
