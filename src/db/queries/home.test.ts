import { extractMetadataText } from "./home-metadata";

it("extracts searchable text from current importer metadata shapes", () => {
  expect(
    extractMetadataText({
      name: "Vương Miện Hoàn Hảo",
      original_name: "Perfect Crown",
      description: "Korean romance drama",
      quality: "HD",
      language: "Vietsub",
      category: {
        "1": {
          group: { name: "Thể loại" },
          list: [{ name: "Lãng Mạn" }, { name: "Tình Cảm" }]
        },
        "2": {
          group: { name: "Quốc gia" },
          list: [{ name: "Hàn Quốc" }]
        }
      }
    })
  ).toContain("Perfect Crown");

  expect(
    extractMetadataText({
      name: "Vương Miện Hoàn Hảo",
      original_name: "Perfect Crown",
      description: "Korean romance drama",
      quality: "HD",
      language: "Vietsub",
      category: {
        "1": {
          group: { name: "Thể loại" },
          list: [{ name: "Lãng Mạn" }, { name: "Tình Cảm" }]
        },
        "2": {
          group: { name: "Quốc gia" },
          list: [{ name: "Hàn Quốc" }]
        }
      }
    })
  ).toContain("Lãng Mạn");

  expect(
    extractMetadataText({
      name: "Vương Miện Hoàn Hảo",
      original_name: "Perfect Crown",
      description: "Korean romance drama",
      quality: "HD",
      language: "Vietsub",
      category: {
        "1": {
          group: { name: "Thể loại" },
          list: [{ name: "Lãng Mạn" }, { name: "Tình Cảm" }]
        },
        "2": {
          group: { name: "Quốc gia" },
          list: [{ name: "Hàn Quốc" }]
        }
      }
    })
  ).toContain("Hàn Quốc");
});
