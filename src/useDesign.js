import { useRef, useState } from "react";
import { freshDesign } from "./lib";
// One gesture is one history entry, regardless of its pointer/input event count.
export function useDesign() {
  const [design, setState] = useState(freshDesign),
    [revision, setRevision] = useState(0);
  const current = useRef(design),
    past = useRef([]),
    future = useRef([]),
    gesture = useRef(null);
  const publish = (value) => {
    current.current = value;
    setState(value);
  };
  const push = (before) => {
    past.current = [...past.current.slice(-39), before];
    future.current = [];
    setRevision((n) => n + 1);
  };
  const finish = () => {
    if (gesture.current && gesture.current !== current.current)
      push(gesture.current);
    gesture.current = null;
  };
  const change = (update) => {
    const next =
      typeof update === "function" ? update(current.current) : update;
    if (next === current.current) return;
    if (!gesture.current) push(current.current);
    publish(next);
  };
  const begin = () => {
    if (!gesture.current) gesture.current = current.current;
  };
  const undo = () => {
    finish();
    const previous = past.current.pop();
    if (!previous) return;
    future.current.unshift(current.current);
    publish(previous);
    setRevision((n) => n + 1);
  };
  const redo = () => {
    finish();
    const next = future.current.shift();
    if (!next) return;
    past.current.push(current.current);
    publish(next);
    setRevision((n) => n + 1);
  };
  const initialize = (value) => {
    past.current = [];
    future.current = [];
    gesture.current = null;
    publish(value);
    setRevision((n) => n + 1);
  };
  return {
    design,
    current,
    change,
    begin,
    finish,
    undo,
    redo,
    initialize,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    revision,
  };
}
