import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

export function RecipeCardSkeleton() {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {/* 画像エリア */}
      <div className="h-40 w-full animate-pulse bg-gray-200" />

      <CardHeader className="flex-1 pb-2">
        <div className="h-5 w-3/4 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-full animate-pulse rounded bg-gray-200" />
      </CardHeader>

      <CardContent className="pb-2 pt-0">
        <div className="h-8 w-full animate-pulse rounded bg-gray-100" />
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-2 pt-2">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-8 flex-1 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
        </div>
      </CardFooter>
    </Card>
  )
}

export function RecipeListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <RecipeCardSkeleton key={index} />
      ))}
    </div>
  )
}
