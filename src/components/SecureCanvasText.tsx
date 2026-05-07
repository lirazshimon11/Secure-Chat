import React, { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";

type Props = {
  text: string;
  color: string;
  direction: "ltr" | "rtl";
  style: any;
};

const FONT_SIZE = 15;
const LINE_HEIGHT = 22;
const HORIZONTAL_NOISE_DENSITY = 0.035;

export function SecureCanvasText({ text, color, direction, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(LINE_HEIGHT);

  useEffect(() => {
    if (Platform.OS !== "web" || !canvasRef.current || width <= 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const usableWidth = Math.max(40, width);
    const font = `400 ${FONT_SIZE}px Arial, sans-serif`;

    ctx.font = font;
    const lines = wrapCanvasText(ctx, text, usableWidth);
    const nextHeight = Math.max(LINE_HEIGHT, lines.length * LINE_HEIGHT);

    canvas.width = Math.ceil(usableWidth * dpr);
    canvas.height = Math.ceil(nextHeight * dpr);
    canvas.style.width = `${usableWidth}px`;
    canvas.style.height = `${nextHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, usableWidth, nextHeight);

    drawNoise(ctx, usableWidth, nextHeight, color);

    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = "top";
    ctx.direction = direction;
    ctx.textAlign = direction === "rtl" ? "right" : "left";

    const x = direction === "rtl" ? usableWidth : 0;
    lines.forEach((line, index) => {
      ctx.fillText(line, x, index * LINE_HEIGHT + 1);
    });

    setHeight(nextHeight);
  }, [color, direction, text, width]);

  if (Platform.OS !== "web") {
    return <Text style={style}>{text}</Text>;
  }

  return (
    <View
      onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}
      style={{ width: "100%", minHeight: height, pointerEvents: "none" } as any}
    >
      {React.createElement("canvas", {
        ref: canvasRef,
        "aria-hidden": true,
        style: {
          display: "block",
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          width: "100%",
          height,
        },
      })}
    </View>
  );
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, rawText: string, maxWidth: number) {
  const lines: string[] = [];
  const hardLines = (rawText || "").split(/\r?\n/);

  hardLines.forEach((hardLine) => {
    const words = hardLine.split(/(\s+)/).filter(Boolean);
    let line = "";

    words.forEach((word) => {
      const candidate = line ? `${line}${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
        if (ctx.measureText(line).width > maxWidth) {
          const chunks = splitLongRun(ctx, line, maxWidth);
          line = chunks.pop() ?? "";
          lines.push(...chunks);
        }
        return;
      }

      lines.push(line.trimEnd());
      line = word.trimStart();
    });

    lines.push(line || " ");
  });

  return lines.length ? lines : [""];
}

function splitLongRun(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const chunks: string[] = [];
  let chunk = "";

  Array.from(text).forEach((char) => {
    const candidate = `${chunk}${char}`;
    if (ctx.measureText(candidate).width <= maxWidth || !chunk) {
      chunk = candidate;
    } else {
      chunks.push(chunk);
      chunk = char;
    }
  });

  if (chunk) chunks.push(chunk);
  return chunks;
}

function drawNoise(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
  const points = Math.floor(width * height * HORIZONTAL_NOISE_DENSITY);
  ctx.fillStyle = color.includes("255") ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)";

  for (let i = 0; i < points; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.globalAlpha = 0.14 + Math.random() * 0.18;
    ctx.fillRect(x, y, 1, 1);
  }

  ctx.globalAlpha = 1;
}
