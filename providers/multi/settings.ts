import { ProviderContext, SettingsField } from "../types";

export const getSettingsSchema = async function (_: { providerContext: ProviderContext }): Promise<SettingsField[]> {
  return [
    {
      key: "multi_preferredServer",
      type: "select",
      label: "Preferred Streaming Server",
      description: "Prioritizes this server's playable stream. Others remain as fallbacks.",
      options: [
        { label: "Auto (Recommended)", value: "auto" },
        { label: "Cineverse", value: "cineverse" },
        { label: "IQST",      value: "iqst" },
        { label: "VidBolt",   value: "vidbolt" },
      ],
      defaultValue: "auto",
    },
  ];
};
