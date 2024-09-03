import dotenv from "dotenv";

dotenv.config();

export const sitesPerRow = parseInt(process.env.SITES_PER_ROW);
export const subPinnedSitesNumber = parseInt(
  process.env.SUB_PINNED_SITES_NUMBER
);

// Tạo một số ngẫu nhiên từ 111111 đến 999999
const random = Math.floor(Math.random() * 888889) + 111111;
// # add a random thing so we can distinguish the firefox process
export const distinguishKey = `-persistentprofileworkaround${random}`;
