/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useState, useMemo, type JSX } from "react";
import { Download, RefreshCcw, ListPlus, Maximize2 } from "lucide-react";
import type { ConfigNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { generateYaml } from "@/lib/yaml-generator";
import { generateEnvVars, generateSystemProperties } from "@/lib/env-var-generator";
import { downloadText } from "@/lib/download-text";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { YamlCodeBlock } from "./yaml-code-block";
import { ImportYamlButton } from "./import-yaml-button";

// ---- Output format ----------------------------------------------------------

type OutputFormat = "yaml" | "env" | "sysprops";

const FORMAT_LABELS: Record<OutputFormat, string> = {
  yaml: "YAML",
  env: "Env Vars",
  sysprops: "Sys Props",
};

const FORMAT_DESCRIPTIONS: Record<OutputFormat, string> = {
  yaml: "Declarative YAML configuration for your OpenTelemetry Java Agent.",
  env: "Instrumentation settings as OTEL_* environment variables.",
  sysprops: "Instrumentation settings as -Dotel.* JVM system properties.",
};

const FORMAT_DIALOG_TITLES: Record<OutputFormat, string> = {
  yaml: "YAML Configuration Preview",
  env: "Environment Variables Preview",
  sysprops: "System Properties Preview",
};

function formatFilename(baseVersion: string, format: OutputFormat): string {
  switch (format) {
    case "yaml":
      return `otel-config-${baseVersion}.yaml`;
    case "env":
      return `otel-config-${baseVersion}.env`;
    case "sysprops":
      return `otel-config-${baseVersion}.properties`;
  }
}

function formatMimeType(format: OutputFormat): string {
  return format === "yaml" ? "text/yaml" : "text/plain";
}

// ---- Sub-components ---------------------------------------------------------

interface HeaderActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  label: string;
}

function HeaderActionButton({
  icon: Icon,
  label,
  className = "",
  ...props
}: HeaderActionButtonProps) {
  return (
    <button
      {...props}
      type="button"
      className={`border-border/60 bg-card text-foreground hover:bg-card/80 focus-visible:ring-primary inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </button>
  );
}

interface FormatToggleProps {
  format: OutputFormat;
  onChange: (format: OutputFormat) => void;
}

function FormatToggle({ format, onChange }: FormatToggleProps) {
  return (
    <div role="group" aria-label="Output format" className="flex overflow-hidden rounded-md border border-border/60 text-xs">
      {(["yaml", "env", "sysprops"] as OutputFormat[]).map((f, idx) => (
        <button
          key={f}
          type="button"
          aria-pressed={format === f}
          onClick={() => onChange(f)}
          className={[
            "cursor-pointer px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
            idx > 0 ? "border-l border-border/60" : "",
            format === f
              ? "bg-primary/10 font-medium text-foreground"
              : "bg-card text-muted-foreground hover:bg-card/80 hover:text-foreground",
          ].join(" ")}
        >
          {FORMAT_LABELS[f]}
        </button>
      ))}
    </div>
  );
}

interface PreviewActionsProps {
  content: string;
  filename: string;
  mimeType: string;
  onValidate: () => void;
}

function PreviewActions({ content, filename, mimeType, onValidate }: PreviewActionsProps) {
  return (
    <>
      <CopyButton
        text={content}
        onClick={onValidate}
        className="border-border/60 bg-card text-foreground hover:bg-card/80 focus-visible:ring-primary inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      />
      <HeaderActionButton
        icon={Download}
        label="Download"
        onClick={() => {
          onValidate();
          downloadText(filename, content, mimeType);
        }}
      />
    </>
  );
}

interface CodePreviewProps {
  format: OutputFormat;
  content: string;
  className: string;
}

function CodePreview({ format, content, className }: CodePreviewProps) {
  if (format === "yaml") {
    return <YamlCodeBlock code={content} className={className} />;
  }
  return <pre className={className}>{content}</pre>;
}

// ---- PreviewCard ------------------------------------------------------------

interface PreviewCardProps {
  schema: ConfigNode;
  javaAgentVersion: string;
}

export function PreviewCard({ schema, javaAgentVersion }: PreviewCardProps): JSX.Element {
  const { state, enableAllSections, resetToDefaults, validateAll } = useConfigurationBuilder();
  const [format, setFormat] = useState<OutputFormat>("yaml");

  const yaml = useMemo(
    () => generateYaml(state, schema, { javaAgentVersion: javaAgentVersion || undefined }),
    [state, schema, javaAgentVersion]
  );

  const envVars = useMemo(
    () => generateEnvVars(state, { javaAgentVersion: javaAgentVersion || undefined }),
    [state, javaAgentVersion]
  );

  const sysProps = useMemo(
    () => generateSystemProperties(state, { javaAgentVersion: javaAgentVersion || undefined }),
    [state, javaAgentVersion]
  );

  const output = format === "yaml" ? yaml : format === "env" ? envVars : sysProps;
  const filename = formatFilename(state.version, format);
  const mimeType = formatMimeType(format);

  const handleReset = () => {
    if (state.isDirty) {
      const ok = window.confirm("Reset to defaults? This will clear your changes.");
      if (!ok) return;
    }
    resetToDefaults();
  };

  const codeClassName =
    "bg-background/60 text-foreground max-h-[calc(100vh-8rem)] overflow-auto rounded-md p-4 font-mono text-xs";

  return (
    <section
      aria-label="Output Preview"
      className="border-border/50 bg-card/40 space-y-3 rounded-xl border p-5 lg:sticky lg:top-20 lg:self-start"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-foreground text-sm font-medium">Output Preview</h3>
          <FormatToggle format={format} onChange={setFormat} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PreviewActions
            content={output}
            filename={filename}
            mimeType={mimeType}
            onValidate={validateAll}
          />
          <ImportYamlButton />
          <span className="bg-border/60 mx-1 h-4 w-px" aria-hidden="true" />
          <HeaderActionButton icon={ListPlus} label="Add all" onClick={enableAllSections} />
          <HeaderActionButton icon={RefreshCcw} label="Reset" onClick={handleReset} />
          <span className="bg-border/60 mx-1 h-4 w-px" aria-hidden="true" />
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label={`Expand ${FORMAT_LABELS[format]} preview`}
                className="border-border/60 bg-card text-foreground hover:bg-card/80 focus-visible:ring-primary flex cursor-pointer items-center justify-center rounded-md border p-1.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[85dvh] w-[90vw] max-w-4xl flex-col gap-4">
              <header className="border-border/30 flex flex-wrap items-center justify-between gap-4 border-b pr-8 pb-3">
                <div className="space-y-1">
                  <DialogTitle className="text-xl font-semibold">
                    {FORMAT_DIALOG_TITLES[format]}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs">
                    {FORMAT_DESCRIPTIONS[format]}
                  </DialogDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <FormatToggle format={format} onChange={setFormat} />
                  <PreviewActions
                    content={output}
                    filename={filename}
                    mimeType={mimeType}
                    onValidate={validateAll}
                  />
                </div>
              </header>
              <div className="bg-background/60 border-border/30 min-h-0 flex-1 overflow-auto rounded-md border p-4">
                <CodePreview
                  format={format}
                  content={output}
                  className="text-foreground font-mono text-xs"
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <CodePreview format={format} content={output} className={codeClassName} />
    </section>
  );
}
