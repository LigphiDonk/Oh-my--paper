export function emit(obj) {
  // Write + flush immediately — critical for streaming.
  // Node.js process.stdout over a pipe is block-buffered by default.
  const data = `${JSON.stringify(obj)}\n`;
  if (process.stdout.write(data) === false) {
    // Backpressure: wait for drain (rare for pipe to parent)
    process.stdout.once("drain", () => {});
  }
}
