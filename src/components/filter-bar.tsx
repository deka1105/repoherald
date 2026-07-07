"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
      <Filter
        param="language"
        placeholder="All languages"
        options={languages.map((l) => ({ value: l, label: l }))}
      />
      <Filter param="useCase" placeholder="All use cases" options={useCases} />
      <Filter param="sector" placeholder="All sectors" options={sectors} />
    </div>
  );
}
