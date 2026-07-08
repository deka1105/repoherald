"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

type Option = { value: string; label: string };

function Filter({
  param,
  placeholder,
  options,
}: {
  param: string;
  placeholder: string;
  options: Option[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? ALL;

  return (
    <Select
      value={current}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams);
        if (value === ALL) params.delete(param);
        else params.set(param, value);
        params.delete("cursor");
        router.push(`/?${params.toString()}`);
      }}
    >
      <SelectTrigger className="h-8 w-40 text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const submit = () => {
    const params = new URLSearchParams(searchParams);
    if (value.trim()) params.set("q", value.trim());
    else params.delete("q");
    params.delete("cursor");
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="relative w-full sm:w-auto">
      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        onBlur={submit}
        placeholder="Search name, owner, category…"
        className="h-8 w-full pl-8 text-sm sm:w-56"
      />
    </div>
  );
}

export function FilterBar({
  languages,
  useCases,
  sectors,
}: {
  languages: string[];
  useCases: Option[];
  sectors: Option[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <SearchBox />
      <Filter
        param="language"
        placeholder="All languages"
        options={languages.map((l) => ({ value: l, label: l }))}
      />
      <Filter param="useCase" placeholder="All use cases" options={useCases} />
      <Filter param="sector" placeholder="All sectors" options={sectors} />
      <Filter
        param="sort"
        placeholder="Sort: Trending"
        options={[{ value: "donations", label: "Sort: Most donated" }]}
      />
    </div>
  );
}
