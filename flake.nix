{
  description = "neo-auth: Rust OIDC provider on Cloudflare Workers (free tier)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            rustup
            pkg-config
            openssl
            buf
            protobuf
            nodejs_22
            wrangler
            just
          ];
          shellHook = ''
            echo "neo-auth shell: run 'rustup toolchain install' once (uses rust-toolchain.toml)"
          '';
        };
      });
}
