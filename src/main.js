import './style.css' with {type: 'css'};
import { ResponsiveCanvas } from "./responsive-canvas.js";
import { HitDetector } from "./hit-detector.js";
import AppEntry from "../implementation/entry.js";

AppEntry({Layer: ResponsiveCanvas, HitDetector});