import * as React from 'react'
import { cn } from '@/lib/utils'

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full text-sm', className)} {...props} />
}
export function Thead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />
}
export function Tbody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />
}
export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b last:border-0 hover:bg-muted/40', className)} {...props} />
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('sticky top-0 z-10 bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground', className)} {...props} />
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2 align-middle', className)} {...props} />
}
