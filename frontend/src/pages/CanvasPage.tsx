import { CanvasWorkspace } from '../components/canvas/CanvasWorkspace';

export function CanvasPage() {
  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">Canvas</h1>
      <CanvasWorkspace notes={[]} />
    </div>
  );
}
