type BannerInput = {
  title: string;
  bannerOverrideUrl: string | null;
  derivedImageUrl: string | null;
  sourceImages: string[];
};

type BannerResult =
  | { type: "image"; value: string }
  | { type: "gradient"; value: string; initials: string };

const gradients = [
  "linear-gradient(135deg, #14532d, #1d4ed8)",
  "linear-gradient(135deg, #7f1d1d, #312e81)",
  "linear-gradient(135deg, #164e63, #831843)",
  "linear-gradient(135deg, #365314, #075985)"
];

export function chooseBanner(input: BannerInput): BannerResult {
  let image = input.bannerOverrideUrl ?? input.derivedImageUrl ?? input.sourceImages.find(Boolean);
  
  if (image) {
    if (/^https?:\/\//i.test(image) && !image.includes('wsrv.nl')) {
      image = `https://wsrv.nl/?url=${encodeURIComponent(image)}`;
    }
    return { type: "image", value: image };
  }

  const initials = input.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "IV";
  const sum = Array.from(input.title.replace(/\s+/g, "")).reduce((total, char) => total + char.charCodeAt(0), 0);

  return {
    type: "gradient",
    value: gradients[(sum + gradients.length - 1) % gradients.length],
    initials
  };
}
