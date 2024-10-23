import { TransactionEvent } from "@tenderly/actions";
// Refer: https://sepolia.basescan.org/tx/0x874f4c0d4becb897d1d9ad2649afd8a928dff4d192b7f6f40275e4174280c8aa
export const handleOpsPayload: TransactionEvent = {
  network: "84532",
  blockHash:
    "0xa3af3aa74e6aefa0beb9bc187b5a1fc8504a2b097bf0b706d9cd9df034040d1b",
  blockNumber: 16949535,
  hash: "0x874f4c0d4becb897d1d9ad2649afd8a928dff4d192b7f6f40275e4174280c8aa",
  transactionHash:
    "0x874f4c0d4becb897d1d9ad2649afd8a928dff4d192b7f6f40275e4174280c8aa",
  from: "0xe97b63899e72efbe9ab3f08967dee4edf1eb4270",
  to: "0x0000000071727de22e5e9d8baf0edac6f37da032",
  logs: [
    {
      address: "0x0000000071727de22e5e9d8baf0edac6f37da032",
      topics: [
        "0xbb47ee3e183a558b1a2ff0874b079f3fc5478b7454eacf2bfc5af2ff5878f972",
      ],
      data: "0x",
    },
    {
      address: "0xbdd6eb5c9a89f21b559f65c6b2bbec265ce54c82",
      topics: [
        "0x4a7d89094dad8258a8c7f96c6cad9b077fe57305ac3e2da96478295d1b48c7d9",
        "0x44f2754b56fe65ecf73936611185a4118cf0c09a21256e34f55766f4aa0b339b",
        "0x000000000000000000000000934aa3a6997c3fa870c1a3d8e76bc49bf24c01de",
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      ],
      data: "0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000067b60000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000",
    },
    {
      address: "0x0000000071727de22e5e9d8baf0edac6f37da032",
      topics: [
        "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f",
        "0x44f2754b56fe65ecf73936611185a4118cf0c09a21256e34f55766f4aa0b339b",
        "0x000000000000000000000000934aa3a6997c3fa870c1a3d8e76bc49bf24c01de",
        "0x000000000000000000000000bdd6eb5c9a89f21b559f65c6b2bbec265ce54c82",
      ],
      data: "0x00000000000000000000000000000000000000000000000000000000000000180000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000003915b000000000000000000000000000000000000000000000000000000000003915b",
    },
    {
      address: "0x44d6f8362c144a1217f24a11be35f2c418b6cb20",
      topics: [
        "0x4a7d89094dad8258a8c7f96c6cad9b077fe57305ac3e2da96478295d1b48c7d9",
        "0x2152d7ea1c5d34756ec0745399d5dcfedc24d05cef028efea659fb8c0f49e598",
        "0x0000000000000000000000007047642db93f086235274fb95d212bdebaf4fefc",
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      ],
      data: "0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000067a60000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001",
    },
    {
      address: "0x0000000071727de22e5e9d8baf0edac6f37da032",
      topics: [
        "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f",
        "0x2152d7ea1c5d34756ec0745399d5dcfedc24d05cef028efea659fb8c0f49e598",
        "0x0000000000000000000000007047642db93f086235274fb95d212bdebaf4fefc",
        "0x00000000000000000000000044d6f8362c144a1217f24a11be35f2c418b6cb20",
      ],
      data: "0x000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000391d100000000000000000000000000000000000000000000000000000000000391d1",
    },
    {
      address: "0x0000000071727de22e5e9d8baf0edac6f37da032",
      topics: [
        "0xf62676f440ff169a3a9afdbf812e89e7f95975ee8e5c31214ffdef631c5f4792",
        "0x90da36ab84f17532117201ccc74a44c07c048db860730fd4a97e091d52db4327",
        "0x000000000000000000000000b0b87ddef364862f5533369963203e7d00ba64bb",
      ],
      data: "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000064ad7954bc0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000458e450b10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    },
    {
      address: "0x0000000071727de22e5e9d8baf0edac6f37da032",
      topics: [
        "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f",
        "0x90da36ab84f17532117201ccc74a44c07c048db860730fd4a97e091d52db4327",
        "0x000000000000000000000000b0b87ddef364862f5533369963203e7d00ba64bb",
        "0x0000000000000000000000004779c973b060c9cc1592b404cad9cb5afb0d4b52",
      ],
      data: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003ef02000000000000000000000000000000000000000000000000000000000003ef02",
    },
  ],
  input:
    "0x765e827f0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000e97b63899e72efbe9ab3f08967dee4edf1eb427000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000028000000000000000000000000000000000000000000000000000000000000004a0000000000000000000000000934aa3a6997c3fa870c1a3d8e76bc49bf24c01de000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000f42400000000000000000000000000016e3600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000061bdd6eb5c9a89f21b559f65c6b2bbec265ce54c820000000000000000000000000007a1200000000000000000000000000007a1200100000000007b0000000001c80000000000000000000000000000000000000000000000000e92596fd62900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007047642db93f086235274fb95d212bdebaf4fefc000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000f42400000000000000000000000000016e360000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006144d6f8362c144a1217f24a11be35f2c418b6cb200000000000000000000000000007a1200000000000000000000000000007a1200100000000007b0000000001c80000000000000000000000000000000000000000000000000e92596fd6290000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b0b87ddef364862f5533369963203e7d00ba64bb000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000f42400000000000000000000000000016e36000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000614779c973b060c9cc1592b404cad9cb5afb0d4b520000000000000000000000000007a1200000000000000000000000000007a1200100000000007b0000000001c80000000000000000000000000000000000000000000000000e92596fd6290000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  value: "0x",
  nonce: "0x6f",
  gas: "0x22a3fd",
  gasUsed: "0x2f407",
  cumulativeGasUsed: "0x49a7d9",
  gasPrice: "0x13a9a6df",
  gasTipCap: "0x0ce316",
  gasFeeCap: "0x273d1f06",
};
