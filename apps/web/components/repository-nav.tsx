"use client";

import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { usePathname } from "next/navigation";
import Link from "./link";

export function RepositoryNav({ repositoryId, queryString = "" }: { repositoryId: string; queryString?: string }) {
  const pathname = usePathname();
  const suffix = queryString ? (queryString.startsWith("?") ? queryString : `?${queryString}`) : "";
  const base = `/repos/${repositoryId}`;
  const activeTab = pathname === base ? "overview" : pathname.slice(base.length + 1).split("/")[0];
  const tabs = [
    { value: "overview", label: "Overview", href: base },
    { value: "benchmarks", label: "Benchmarks", href: `${base}/benchmarks` },
    { value: "behaviour", label: "Agent behaviour", href: `${base}/behaviour` },
    { value: "structure", label: "Structure", href: `${base}/structure` },
    { value: "insights", label: "Insights", href: `${base}/insights` },
    { value: "prompts", label: "Prompts", href: `${base}/prompts` },
    { value: "hotspots", label: "Hotspots", href: `${base}/hotspots` },
    { value: "tools", label: "Tool health", href: `${base}/tools` },
    { value: "comparisons", label: "Model comparisons", href: `${base}/comparisons` },
  ];

  return <Box component="nav" aria-label="Repository sections" sx={{ borderBottom: 1, borderColor: "divider", my: 3 }}>
    <Tabs
      value={tabs.some((tab) => tab.value === activeTab) ? activeTab : false}
      aria-label="Repository sections"
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
    >
      {tabs.map((tab) => (
        <Tab
          component={Link}
          href={`${tab.href}${suffix}`}
          key={tab.value}
          label={tab.label}
          value={tab.value}
          sx={{ fontWeight: 800, minHeight: 52 }}
        />
      ))}
    </Tabs>
  </Box>;
}
