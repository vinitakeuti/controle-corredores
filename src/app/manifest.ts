import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pace Lab",
    short_name: "Pace Lab",
    description: "A academia do corredor.",
    start_url: "/",
    display: "standalone",
    background_color: "#edf0ec",
    theme_color: "#151a1a",
    icons: [{ src: "/assets/images/pace-lab.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
