import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WandSparklesIcon } from 'lucide-react'
import { ReactNode, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { toast } from 'react-toastify'
import { z } from 'zod'
import { Button } from '@/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/app/components/ui/form'
import { Input } from '@/app/components/ui/input'
import { Switch } from '@/app/components/ui/switch'
import { subsonic } from '@/service/subsonic'
import { useRadios } from '@/store/radios.store'
import { Radio } from '@/types/responses/radios'
import { queryKeys } from '@/utils/queryKeys'
import { derivedAzuraCastApiUrl } from '@/utils/radioMetadata'

const radioSchema = z
  .object({
    name: z.string().min(3, { message: 'radios.form.validations.name' }),
    streamUrl: z
      .string()
      .url({ message: 'radios.form.validations.url' })
      .min(10, { message: 'radios.form.validations.streamUrlLength' })
      .refine((value) => /^https?:\/\//.test(value), {
        message: 'login.form.validations.protocol',
      }),
    useAzuraCastApi: z.boolean(),
    apiUrl: z.string(),
    showSongCover: z.boolean(),
  })
  .superRefine(({ useAzuraCastApi, apiUrl }, context) => {
    if (!useAzuraCastApi) return

    if (!/^https?:\/\/\S+$/.test(apiUrl.trim())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['apiUrl'],
        message: 'radios.form.validations.url',
      })
    }
  })

type RadioSchema = z.infer<typeof radioSchema>

const defaultValues: RadioSchema = {
  name: '',
  streamUrl: '',
  useAzuraCastApi: false,
  apiUrl: '',
  showSongCover: true,
}

interface SectionProps {
  title: string
  children: ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="rounded-lg border bg-background-foreground divide-y">
        {children}
      </div>
    </section>
  )
}

interface RowProps {
  label: string
  htmlFor?: string
  children: ReactNode
}

// The label on the left, the value on the right, like a list of settings
function Row({ label, htmlFor, children }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 min-h-12">
      <label htmlFor={htmlFor} className="text-sm shrink-0">
        {label}
      </label>
      <div className="min-w-0 flex-1 flex justify-end">{children}</div>
    </div>
  )
}

const inlineInput =
  'h-auto border-0 bg-transparent p-0 text-right text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0'

export function RadioFormDialog() {
  const { t } = useTranslation()
  const { data, setData, dialogState, setDialogState } = useRadios()

  const isCreation = Object.keys(data).length === 0

  const form = useForm<RadioSchema>({
    resolver: zodResolver(radioSchema),
    defaultValues,
  })

  const { data: allSettings, isFetched: settingsFetched } = useQuery({
    queryKey: [queryKeys.radio.settings],
    queryFn: subsonic.radios.getSettings,
    enabled: dialogState,
  })

  useEffect(() => {
    if (isCreation) {
      form.reset(defaultValues)
      return
    }
    if (!settingsFetched) return

    const settings = allSettings?.[data.id]

    form.reset({
      name: data.name ?? '',
      streamUrl: data.streamUrl ?? '',
      useAzuraCastApi: settings?.useAzuraCastApi ?? false,
      apiUrl: settings?.apiUrl ?? '',
      showSongCover: settings?.showSongCover ?? true,
    })
  }, [data, form, isCreation, allSettings, settingsFetched])

  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: subsonic.radios.create,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [queryKeys.radio.all],
      })
      toast.success(t('radios.form.create.toast.success'))
    },
    onError: () => {
      toast.error(t('radios.form.create.toast.error'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: subsonic.radios.update,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [queryKeys.radio.all],
      })
      toast.success(t('radios.form.edit.toast.success'))
    },
    onError: () => {
      toast.success(t('radios.form.edit.toast.error'))
    },
  })

  // Navidrome does not return the id of a new station, so it is looked up
  async function findCreatedStationId(name: string, streamUrl: string) {
    const stations = await subsonic.radios.getAll()

    return stations
      .filter(
        (station) => station.name === name && station.streamUrl === streamUrl,
      )
      .at(-1)?.id
  }

  async function saveSettings(
    stationId: string | undefined,
    values: RadioSchema,
  ) {
    if (!stationId) return

    const hadSettings = allSettings?.[stationId] !== undefined
    const apiUrl = values.apiUrl.trim()

    try {
      if (!values.useAzuraCastApi && !apiUrl) {
        if (hadSettings) await subsonic.radios.removeSettings(stationId)
      } else {
        await subsonic.radios.saveSettings(stationId, {
          name: values.name,
          useAzuraCastApi: values.useAzuraCastApi,
          apiUrl,
          showSongCover: values.showSongCover,
        })
      }
    } catch {
      toast.error(t('radios.form.azuracast.saveError'))
    }

    queryClient.invalidateQueries({ queryKey: [queryKeys.radio.settings] })
  }

  async function onSubmit(values: RadioSchema) {
    const { name, streamUrl } = values
    let stationId: string | undefined = data.id

    if (isCreation) {
      await createMutation.mutateAsync({ name, streamUrl })
      stationId = await findCreatedStationId(name, streamUrl)
    } else {
      // Navidrome overwrites the homepage on update, so the stored one is kept
      await updateMutation.mutateAsync({
        id: data.id,
        name,
        homePageUrl: data.homePageUrl,
        streamUrl,
      })
    }

    await saveSettings(stationId, values)

    setDialogState(false)
    clear()
  }

  function clear() {
    setData({} as Radio)
  }

  function fillApiUrl() {
    const derived = derivedAzuraCastApiUrl(form.getValues('streamUrl'))
    if (derived) form.setValue('apiUrl', derived, { shouldValidate: true })
  }

  const useAzuraCastApi = form.watch('useAzuraCastApi')

  return (
    <Dialog
      defaultOpen={false}
      open={dialogState}
      onOpenChange={(state) => {
        if (!state) clear()
        setDialogState(state)
      }}
    >
      <DialogContent className="max-w-[520px]" aria-describedby={undefined}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>
                {t(`radios.form.${isCreation ? 'create' : 'edit'}.title`)}
              </DialogTitle>
            </DialogHeader>

            <div className="my-5 space-y-5">
              <Section title={t('radios.form.streamData')}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <Row label={t('radios.table.name')} htmlFor="radio-name">
                        <FormControl>
                          <Input
                            {...field}
                            id="radio-name"
                            className={inlineInput}
                          />
                        </FormControl>
                      </Row>
                      <FormMessage className="px-4 pb-2 text-right" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="streamUrl"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <Row
                        label={t('radios.form.streamingLink')}
                        htmlFor="radio-stream-url"
                      >
                        <FormControl>
                          <Input
                            {...field}
                            id="radio-stream-url"
                            className={inlineInput}
                            autoCorrect="false"
                            autoCapitalize="false"
                            spellCheck="false"
                          />
                        </FormControl>
                      </Row>
                      <FormMessage className="px-4 pb-2 text-right" />
                    </FormItem>
                  )}
                />
              </Section>

              <Section title={t('radios.form.azuracast.title')}>
                <FormField
                  control={form.control}
                  name="useAzuraCastApi"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <Row
                        label={t('radios.form.azuracast.use')}
                        htmlFor="radio-use-azuracast"
                      >
                        <FormControl>
                          <Switch
                            id="radio-use-azuracast"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </Row>
                    </FormItem>
                  )}
                />

                {useAzuraCastApi && (
                  <>
                    <FormField
                      control={form.control}
                      name="apiUrl"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <Row
                            label={t('radios.form.azuracast.apiUrl')}
                            htmlFor="radio-api-url"
                          >
                            <FormControl>
                              <Input
                                {...field}
                                id="radio-api-url"
                                className={inlineInput}
                                autoCorrect="false"
                                autoCapitalize="false"
                                spellCheck="false"
                              />
                            </FormControl>
                          </Row>
                          <FormMessage className="px-4 pb-2 text-right" />
                        </FormItem>
                      )}
                    />

                    <div className="px-3 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary"
                        onClick={fillApiUrl}
                      >
                        <WandSparklesIcon className="size-4 mr-2" />
                        {t('radios.form.azuracast.fill')}
                      </Button>
                    </div>

                    <FormField
                      control={form.control}
                      name="showSongCover"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <Row
                            label={t('radios.form.azuracast.showCover')}
                            htmlFor="radio-show-cover"
                          >
                            <FormControl>
                              <Switch
                                id="radio-show-cover"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </Row>
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </Section>

              <div className="rounded-lg border bg-background-foreground divide-y text-xs">
                <div className="px-4 py-3 space-y-0.5">
                  <p className="font-semibold">
                    {t('radios.form.azuracast.format')}
                  </p>
                  <p className="text-muted-foreground break-all">
                    https://your-domain.com/api/nowplaying/station_shortcode
                  </p>
                </div>
                <div className="px-4 py-3 space-y-0.5">
                  <p className="font-semibold">
                    {t('radios.form.azuracast.supportedFormats')}
                  </p>
                  <p className="text-muted-foreground">HLS, MP3, AAC</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  clear()
                  setDialogState(false)
                }}
              >
                {t('radios.form.cancel')}
              </Button>
              <Button type="submit">
                {t(`radios.form.${isCreation ? 'create' : 'edit'}.button`)}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
