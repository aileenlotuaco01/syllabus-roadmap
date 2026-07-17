const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const assetUrl = new URL(pathname, request.url);
    return env.ASSETS.fetch(new Request(assetUrl, request));
  },
};

export default worker;
