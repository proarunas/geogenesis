'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import * as React from 'react';

import { fetchVersions } from '~/core/io/subgraph/fetch-versions';
import { useDiff } from '~/core/state/diff-store';
import { useEntityPageStore } from '~/core/state/entity-page-store/entity-store';

import { SmallButton } from '~/design-system/button';
import { Dots } from '~/design-system/dots';

import { HistoryEmpty } from '../history/history-empty';
import { HistoryItem } from '../history/history-item';
import { HistoryPanel } from '../history/history-panel';
import { EntityPageContextMenu } from './entity-page-context-menu';
import { EntityPageTypeChip } from './entity-page-type-chip';

interface EntityPageMetadataHeaderProps {
  id: string;
  spaceId: string;
}

export function EntityPageMetadataHeader({ id, spaceId }: EntityPageMetadataHeaderProps) {
  const {
    data: versions,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [`entity-versions-for-entityId-${id}`],
    queryFn: ({ signal, pageParam = 0 }) => fetchVersions({ entityId: id, page: pageParam, signal }),
    getNextPageParam: (_lastPage, pages) => pages.length,
    initialPageParam: 0,
  });

  const { types } = useEntityPageStore();
  const { setCompareMode, setSelectedVersion, setPreviousVersion, setIsCompareOpen } = useDiff();

  const isOnePage = versions?.pages && versions.pages[0].length < 5;

  const isLastPage =
    versions?.pages &&
    versions.pages.length > 1 &&
    versions.pages[versions.pages.length - 1]?.[0]?.id === versions.pages[versions.pages.length - 2]?.[0]?.id;

  const renderedVersions = !isLastPage ? versions?.pages : versions?.pages.slice(0, -1);
  const showMore = !isOnePage && !isLastPage;

  return (
    <div className="flex items-center justify-between text-text">
      <ul className="flex items-center gap-1">
        {types.map(t => (
          <li key={t.id}>
            <EntityPageTypeChip type={t} />
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <HistoryPanel>
          {versions?.pages?.length === 0 && <HistoryEmpty />}
          {renderedVersions?.map((group, index) => (
            <React.Fragment key={index}>
              {group.map((v, index) => (
                <HistoryItem
                  key={v.id}
                  onClick={() => {
                    setCompareMode('versions');
                    setPreviousVersion(group[index + 1]?.versionId ?? '');
                    setSelectedVersion(v.versionId);
                    setIsCompareOpen(true);
                  }}
                  // @TODO: Fix change count
                  changeCount={0}
                  createdAt={v.createdAt}
                  createdBy={v.createdBy}
                  name={v.editName}
                />
              ))}
            </React.Fragment>
          ))}
          {showMore && (
            <div className="flex h-12 w-full flex-shrink-0 items-center justify-center bg-white">
              {isFetching || isFetchingNextPage ? (
                <Dots />
              ) : (
                <SmallButton variant="secondary" onClick={() => fetchNextPage()}>
                  Show more
                </SmallButton>
              )}
            </div>
          )}
        </HistoryPanel>
        <EntityPageContextMenu entityId={id} spaceId={spaceId} />
      </div>
    </div>
  );
}
