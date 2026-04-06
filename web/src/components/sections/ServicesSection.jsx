import { Box, Stack, Typography, Button, List, ListItem, ListItemText } from '@mui/material'

const rowBorder = { borderBottom: '1px solid', borderColor: 'divider' }

function SectionHeader({ title, subtitle }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>}
    </Box>
  )
}

function Card({ children, sx = {} }) {
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, ...sx }}>
      {children}
    </Box>
  )
}

export default function ServicesSection({ services, onConnect, onDisconnect }) {
  return (
    <Box>
      <SectionHeader title="Services" subtitle="Apps connected to your Neo ID account" />
      <Stack spacing={2}>
        <Card>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>Connected</Typography>
          {(services.connected_services || []).length === 0
            ? <Typography variant="body2" color="text.secondary">No services connected</Typography>
            : <List dense disablePadding>
              {(services.connected_services || []).map((s) => (
                <ListItem key={s.name} disablePadding sx={{ py: 0.75, ...rowBorder }} secondaryAction={<Button size="small" color="error" onClick={() => onDisconnect(s.name)} sx={{ fontSize: '0.75rem' }}>Disconnect</Button>}>
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontWeight: 500 }}>{s.display_name || s.name}</Typography>}
                    secondary={<Typography variant="caption" color="text.secondary">{s.description}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          }
        </Card>
        {(services.available_services || []).length > 0 && (
          <Card>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>Available</Typography>
            <List dense disablePadding>
              {(services.available_services || []).map((s) => (
                <ListItem key={s.name} disablePadding sx={{ py: 0.75, ...rowBorder }} secondaryAction={<Button size="small" variant="outlined" onClick={() => onConnect(s.name)} sx={{ fontSize: '0.75rem' }}>Connect</Button>}>
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontWeight: 500 }}>{s.display_name || s.name}</Typography>}
                    secondary={<Typography variant="caption" color="text.secondary">{s.description}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          </Card>
        )}
      </Stack>
    </Box>
  )
}
