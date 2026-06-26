type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

const escapeJsonForHtml = (value: Record<string, unknown> | Array<Record<string, unknown>>) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: escapeJsonForHtml(data) }}
    />
  );
}
