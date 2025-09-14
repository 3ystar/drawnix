import { useBoard } from '@plait-board/react-board';
import Stack from '../../stack';
import { ToolButton } from '../../tool-button';
import {
  DuplicateIcon,
  MenuIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
} from '../../icons';
import classNames from 'classnames';
import {
  ATTACHED_ELEMENT_CLASS_NAME,
  deleteFragment,
  duplicateElements,
  getSelectedElements,
  PlaitBoard,
} from '@plait/core';
import { Island } from '../../island';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover/popover';
import { useEffect, useState } from 'react';
import { CleanBoard, OpenFile, SaveAsImage, SaveToFile, Socials } from './app-menu-items';
import { LanguageSwitcherMenu } from './language-switcher-menu';
import Menu from '../../menu/menu';
import MenuSeparator from '../../menu/menu-separator';
import { useI18n } from '../../../i18n';

const FileNameEditor: React.FC = () => {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // 读取当前会话中的画板ID
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const id = sessionStorage.getItem('editor-board-id:default');
      setBoardId(id);
    } catch (err) {
      // ignore
    }
  }, []);

  // 拉取标题
  useEffect(() => {
    if (!boardId) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/boards/${boardId}`, { cache: 'no-store' });
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.success) {
            setTitle(data.data?.title || '未命名画板');
          }
        }
      } catch (err) {
        // ignore
      }
    })();
    return () => { mounted = false };
  }, [boardId]);

  const save = async (nextTitle: string): Promise<void> => {
    if (!boardId) return;
    const trimmed = (nextTitle || '').trim() || '未命名画板';
    if (trimmed === title) return;
    setLoading(true);
    try {
      await fetch(`/api/boards/${boardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      setTitle(trimmed);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    // 将子元素容器设置最小宽度，去除 gap，避免旧类型下的 IDE 报错
    <div style={{ display: 'flex', alignItems: 'center', maxWidth: 120 }}>
      {!editing ? (
        <span
          data-testid="board-filename"
          title={title}
          onClick={() => setEditing(true)}
          style={{
            maxWidth: 320,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: 'text',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {title || '未命名画板'}
        </span>
      ) : (
        <input
          data-testid="board-filename-input"
          autoFocus
          defaultValue={title}
          onBlur={async (e) => { await save(e.currentTarget.value); setEditing(false); }}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') { await save(e.currentTarget.value); setEditing(false); }
            if (e.key === 'Escape') { setEditing(false); }
          }}
          style={{
            maxWidth: 120,
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 14,
          }}
        />
      )}
    </div>
  );
};

export const AppToolbar = () => {
  const board = useBoard();
  const { t } = useI18n();
  const container = PlaitBoard.getBoardContainer(board);
  const selectedElements = getSelectedElements(board);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const isUndoDisabled = board.history.undos.length <= 0;
  const isRedoDisabled = board.history.redos.length <= 0;
  return (
    <Island
      padding={1}
      className={classNames('app-toolbar', ATTACHED_ELEMENT_CLASS_NAME)}
    >
      <Stack.Row gap={1}>
      {/* 关闭并保存画板，返回上一页*/}
      <ToolButton
        key={0}
        type="icon"
        icon={CloseIcon}
        visible={true}
        title={t('general.close')}
        aria-label={t('general.close')}
        onPointerDown={async () => {
          setAppMenuOpen(false);
          // 1) 保存当前画板内容（忽略错误，尽最大努力）
          try {
            if (typeof window !== 'undefined') {
              const id = sessionStorage.getItem('editor-board-id:default');
              if (id) {
                try {
                  await fetch(`/api/boards/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: (board as any).children }),
                  });
                } catch (err) {
                  // ignore save error
                }
              }
            }
          } catch {}
          // 2) 返回上一页：优先使用显式 returnTo，其次 history.back，兜底首页
          try {
            if (typeof window !== 'undefined') {
              const returnTo = sessionStorage.getItem('editor-board:returnTo');
              if (returnTo) {
                try { sessionStorage.removeItem('editor-board:returnTo'); } catch {}
                try {
                  const url = new URL(returnTo, window.location.origin);
                  if (url.origin === window.location.origin) {
                    window.location.href = url.pathname + url.search + url.hash;
                    return;
                  }
                } catch {
                  // fall through
                }
              }
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = '/';
              }
            }
          } catch {}
        }}
      />
      {/* 文件名编辑器 */}
      <div style={{ flex: 1 }} />
      <div style={{ marginLeft: 10,marginRight: 10, display: 'flex', alignItems: 'center' }}>
        <FileNameEditor />
      </div>
        <Popover
          key={0}
          sideOffset={12}
          open={appMenuOpen}
          onOpenChange={(open) => {
            setAppMenuOpen(open);
          }}
          placement="bottom-start"
        >
          <PopoverTrigger asChild>
            <ToolButton
              type="icon"
              visible={true}
              selected={appMenuOpen}
              icon={MenuIcon}
              title={t('general.menu')}
              aria-label={t('general.menu')}
              onPointerDown={() => {
                setAppMenuOpen(!appMenuOpen);
              }}
            />
          </PopoverTrigger>
          <PopoverContent container={container}>
            <Menu
              onSelect={() => {
                setAppMenuOpen(false);
              }}
            >
              <OpenFile></OpenFile>
              <SaveToFile></SaveToFile>
              <SaveAsImage></SaveAsImage>
              <CleanBoard></CleanBoard>
              <MenuSeparator />
              <LanguageSwitcherMenu />
              <Socials />
            </Menu>
          </PopoverContent>
        </Popover>

        <ToolButton
          key={1}
          type="icon"
          icon={UndoIcon}
          visible={true}
          title={t('general.undo')}
          aria-label={t('general.undo')}
          onPointerUp={() => {
            board.undo();
          }}
          disabled={isUndoDisabled}
        />
        <ToolButton
          key={2}
          type="icon"
          icon={RedoIcon}
          visible={true}
          title={t('general.redo')}
          aria-label={t('general.redo')}
          onPointerUp={() => {
            board.redo();
          }}
          disabled={isRedoDisabled}
        />
        {selectedElements.length > 0 && (
          <ToolButton
            className="duplicate"
            key={3}
            type="icon"
            icon={DuplicateIcon}
            visible={true}
            title={t('general.duplicate')}
            aria-label={t('general.duplicate')}
            onPointerUp={() => {
              duplicateElements(board);
            }}
          />
        )}
        {selectedElements.length > 0 && (
          <ToolButton
            className="trash"
            key={4}
            type="icon"
            icon={TrashIcon}
            visible={true}
            title={t('general.delete')}
            aria-label={t('general.delete')}
            onPointerUp={() => {
              deleteFragment(board);
            }}
          />
        )}
      </Stack.Row>
    </Island>
  );
};
