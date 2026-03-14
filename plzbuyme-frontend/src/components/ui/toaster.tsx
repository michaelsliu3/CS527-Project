"use client"

import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react"

export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
})

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root width={{ md: "sm" }}>
            {toast.type === "loading" ? (
              <Spinner size="sm" color="blue.solid" />
            ) : (
              <Toast.Indicator />
            )}
            <Stack gap="1" flex="1" maxWidth="100%">
              {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
              {toast.description && (
                <Toast.Description>{toast.description}</Toast.Description>
              )}
            </Stack>
            {toast.action && (
              <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            )}
            {toast.closable && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}

export function showErrorToast(title: string, description?: string) {
  toaster.create({
    title,
    description: description ?? undefined,
    type: "error",
    duration: 5000,
  })
}

export function showSuccessToast(title: string, description?: string) {
  toaster.create({
    title,
    description: description ?? undefined,
    type: "success",
    duration: 3000,
  })
}

export const notificationToaster = createToaster({
  placement: "top-end",
  pauseOnPageIdle: true,
})

export const NotificationToaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={notificationToaster} insetInline={{ mdDown: "4" }}>
        {(toast) => {
          const onClick = (toast as { onClick?: () => void }).onClick
          const handleClick = () => {
            onClick?.()
            if (toast.id != null) notificationToaster.dismiss(toast.id)
          }
          return (
            <Toast.Root
              width={{ md: "sm" }}
              cursor={onClick ? "pointer" : undefined}
              onClick={onClick ? handleClick : undefined}
            >
              {toast.type === "loading" ? (
                <Spinner size="sm" color="blue.solid" />
              ) : (
                <Toast.Indicator />
              )}
              <Stack gap="1" flex="1" maxWidth="100%">
                {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
                {toast.description && (
                  <Toast.Description>{toast.description}</Toast.Description>
                )}
              </Stack>
              {toast.closable !== false && <Toast.CloseTrigger />}
            </Toast.Root>
          )
        }}
      </ChakraToaster>
    </Portal>
  )
}

export interface NotificationToastOptions {
  onClick?: () => void
}

export function showNotificationToast(
  title: string,
  description?: string,
  options?: NotificationToastOptions
) {
  notificationToaster.create({
    title,
    description: description ?? undefined,
    type: "info",
    duration: 5000,
    closable: true,
    ...options,
  })
}
