import Link from "next/link";

type SeoBreadcrumbItem = {
  href: string;
  name: string;
};

type SeoBreadcrumbProps = {
  items: SeoBreadcrumbItem[];
};

export function SeoBreadcrumb({ items }: SeoBreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="sr-only">
      <ol>
        {items.map((item, index) => (
          <li key={item.href + item.name}>
            {index < items.length - 1 ? (
              <Link href={item.href}>{item.name}</Link>
            ) : (
              <span aria-current="page">{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
