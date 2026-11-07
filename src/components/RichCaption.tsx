import React from "react";
import { Text, TextStyle, StyleProp } from "react-native";

/** Divide o texto em pedaços normais, #hashtags e @menções */
// letras com acento sem depender de \p{L} (nem todo motor JS aceita)
const WORD = "A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF";
const TOKEN_RE = new RegExp(`([#@])([${WORD}.]{1,40})`, "g");
const WORD_CHAR = new RegExp(`[${WORD}]`);

export function parseCaption(text: string): { type: "text" | "tag" | "mention"; value: string }[] {
  const out: { type: "text" | "tag" | "mention"; value: string }[] = [];
  const re = new RegExp(TOKEN_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    // # ou @ só contam no começo ou depois de espaço/pontuação (evita e-mails)
    const before = m.index > 0 ? text[m.index - 1] : " ";
    if (WORD_CHAR.test(before)) continue;
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    const value = m[2].replace(/\.+$/, "");
    out.push({ type: m[1] === "#" ? "tag" : "mention", value });
    last = m.index + 1 + value.length;
    re.lastIndex = last;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/** Legenda com #hashtags e @menções clicáveis */
export function RichCaption({
  text,
  style,
  linkColor = "#4AA3FF",
  onTag,
  onMention,
  prefix
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  linkColor?: string;
  onTag?: (tag: string) => void;
  onMention?: (username: string) => void;
  prefix?: React.ReactNode;
}) {
  return (
    <Text style={style}>
      {prefix}
      {parseCaption(text || "").map((part, i) =>
        part.type === "text" ? (
          <Text key={i}>{part.value}</Text>
        ) : (
          <Text
            key={i}
            style={{ color: linkColor, fontWeight: "700" }}
            onPress={() => (part.type === "tag" ? onTag?.(part.value) : onMention?.(part.value))}
          >
            {part.type === "tag" ? "#" : "@"}
            {part.value}
          </Text>
        )
      )}
    </Text>
  );
}
