(function () {
  "use strict";

  function hex(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
  }

  function fromHex(value) {
    var pairs = value.match(/../g) || [];
    return Uint8Array.from(pairs.map(function (h) { return parseInt(h, 16); }));
  }

  function base64(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async function deriveKey(nonce, counter, salt, cost, keyLength) {
    var password = new Uint8Array(nonce.length + 4);
    password.set(nonce, 0);
    new DataView(password.buffer).setUint32(nonce.length, counter, false);
    var key = await crypto.subtle.importKey("raw", password, "PBKDF2", false, ["deriveBits"]);
    var bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt, iterations: cost, hash: "SHA-256" },
      key,
      keyLength * 8
    );
    return new Uint8Array(bits);
  }

  async function solve(challenge) {
    var parameters = challenge.parameters;
    var nonce = fromHex(parameters.nonce);
    var salt = fromHex(parameters.salt);
    var prefix = (parameters.keyPrefix || "00").toLowerCase();
    for (var counter = 0; ; counter++) {
      var derived = hex(await deriveKey(nonce, counter, salt, parameters.cost, parameters.keyLength));
      if (derived.startsWith(prefix)) {
        return { counter: counter, derivedKey: derived };
      }
    }
  }

  async function payload(challengeUrl) {
    var response = await fetch(challengeUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error("challenge request failed: " + response.status);
    }
    var challenge = await response.json();
    var solution = await solve(challenge);
    var body = {
      challenge: challenge,
      solution: { counter: solution.counter, derivedKey: solution.derivedKey }
    };
    return base64(new TextEncoder().encode(JSON.stringify(body)));
  }

  var Altcha = {
    defaultChallengeUrl: "/api/v1/captcha/altcha",
    solve: solve,
    payload: payload
  };
  window.NeoAltcha = Altcha;

  var AltchaWidget = /** @class */ (function () {
    function Widget() {
      return Reflect.construct(HTMLElement, [], Widget);
    }
    Widget.prototype = Object.create(HTMLElement.prototype);
    Widget.prototype.constructor = Widget;

    Widget.prototype.connectedCallback = function () {
      if (this._started) { return; }
      this._started = true;
      this._challengeUrl = this.getAttribute("challengeurl") || Altcha.defaultChallengeUrl;
      var name = this.getAttribute("name") || "altcha";
      this._input = document.createElement("input");
      this._input.type = "hidden";
      this._input.name = name;
      this._status = document.createElement("div");
      this._status.className = "altcha-status";
      this._status.textContent = "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430\u2026";
      this.appendChild(this._status);
      this.appendChild(this._input);
      this._run();
    };

    Widget.prototype._run = async function () {
      try {
        this._input.value = await payload(this._challengeUrl);
        this._status.textContent = "\u0413\u043e\u0442\u043e\u0432\u043e";
        this.dispatchEvent(new CustomEvent("verified", { detail: this._input.value }));
      } catch (error) {
        this._status.textContent = "\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438";
        this.dispatchEvent(new CustomEvent("error", { detail: error }));
      }
    };

    return Widget;
  })();

  if (!customElements.get("altcha-widget")) {
    customElements.define("altcha-widget", AltchaWidget);
  }
})();
