import { uploadFiles } from "../uploads";
import { describe, it, expect, vi, afterEach } from "vitest";

describe("uploadFiles", () => {
  const originalXHR = global.XMLHttpRequest;

  afterEach(() => {
    global.XMLHttpRequest = originalXHR;
    vi.restoreAllMocks();
  });

  it("uploads files and reports progress with onProgress callback", async () => {
    const progressEvents = [];
    const fakeResponse = { files: [{ url: "http://example.com/proof.png" }] };

    function FakeXHR() {
      this.upload = {};
      this.open = vi.fn();
      this.setRequestHeader = vi.fn();
      this.send = () => {
        setTimeout(() => {
          if (typeof this.upload.onprogress === "function") {
            this.upload.onprogress({ lengthComputable: true, loaded: 100, total: 100 });
          }
          this.status = 200;
          this.responseText = JSON.stringify(fakeResponse);
          if (typeof this.onload === "function") {
            this.onload();
          }
        }, 0);
      };
      this.onerror = null;
    }

    global.XMLHttpRequest = FakeXHR;

    const file = new File(["filecontent"], "proof.png", { type: "image/png" });
    const result = await uploadFiles([file], (progress) => {
      progressEvents.push(progress);
    });

    expect(progressEvents).toContain(100);
    expect(result).toEqual(fakeResponse);
  });
});
