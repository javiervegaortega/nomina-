const fs = require('fs');

const file = 'c:/Users/juanp/OneDrive/Desktop/nomina-/frontend/src/components/EmployeeFormModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const newTabsContent = `
            {/* --- TAB: EMPRESA --- */}
            {tab === 'empresa' && (
              <Box>
                <SectionTitle title="Jerarquía Corporativa" />
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={6} mb={8}>
                  <SelectField label="Departamento (OBLIGATORIO)" val={form.departamento_laboral} onChange={v => { handleChange('departamento_laboral', v); handleChange('areaId', ''); handleChange('divisionId', ''); handleChange('subdivisionId', ''); handleChange('nivel_5', ''); }} options={DEPARTAMENTOS_LIST} required />
                  <SelectField label="Área (OBLIGATORIO)" val={form.areaId} onChange={v => { handleChange('areaId', v); handleChange('divisionId', ''); handleChange('subdivisionId', ''); handleChange('nivel_5', ''); }} options={(areas || []).filter(a => !form.departamento_laboral || a.departamento === form.departamento_laboral || a.departamento_id === form.departamento_laboral || a.nombre_dimension === form.departamento_laboral)} required />
                  <SelectField label="División (OBLIGATORIO)" val={form.divisionId} onChange={v => { handleChange('divisionId', v); handleChange('subdivisionId', ''); handleChange('nivel_5', ''); }} options={(divisions || []).filter(d => !form.areaId || d.area === form.areaId || d.area_id === form.areaId || d.padre_id === form.areaId || d.padre === form.areaId || d.nombre_dimension === form.areaId)} required />
                  <SelectField label="Sub División" val={form.subdivisionId} onChange={v => { handleChange('subdivisionId', v); handleChange('nivel_5', ''); }} options={(subdivisions || []).filter(s => !form.divisionId || s.division === form.divisionId || s.division_id === form.divisionId || s.padre_id === form.divisionId || s.padre === form.divisionId || s.nombre_dimension === form.divisionId)} />
                  <SelectField label="Nivel 5" val={form.nivel_5} onChange={v => handleChange('nivel_5', v)} options={[]} />
                  <Field label="Puesto (OBLIGATORIO)" val={form.puesto} onChange={v => handleChange('puesto', v)} required />
                </SimpleGrid>

                <SectionTitle title="Distribución por Empresa" />
                <Box mb={6} p={5} borderRadius="xl" bg={distBoxBg} border="1px solid" borderColor={distTotal !== 100 ? 'red.400' : distBoxBorder}>
                  <Flex justify="space-between" align="center" mb={4}>
                    <Box>
                      <Text fontSize="sm" fontWeight={700} color={distTotal !== 100 ? 'red.500' : 'inherit'}>Empresas Asignadas</Text>
                      {distTotal !== 100 && (
                        <Text fontSize="xs" color="red.500" fontWeight="bold">Aviso: La distribución debe sumar 100%. (Actual: {distTotal}%)</Text>
                      )}
                    </Box>
                    <Badge colorScheme={distTotal === 100 ? 'green' : 'red'} px={2}>{distTotal}%</Badge>
                  </Flex>
                  <SimpleGrid columns={{ base: 1, md: 3 }} mb={2} px={4} borderBottom="1px solid" borderColor={borderColor} pb={2}>
                    <Text fontSize="xs" fontWeight={700} color={subtitleColor}>Empresa</Text>
                    <Text fontSize="xs" fontWeight={700} color={subtitleColor}>Porcentaje</Text>
                    <Text fontSize="xs" fontWeight={700} color={subtitleColor} textAlign="center">Principal</Text>
                  </SimpleGrid>
                  {companies?.map(c => (
                    <SimpleGrid columns={{ base: 1, md: 3 }} key={c.id} py={3} px={4} borderBottom="1px solid" borderColor={distBoxBorder} alignItems="center" transition="all 0.2s" _hover={{ bg: 'whiteAlpha.100' }}>
                      <Text fontSize="sm" fontWeight={600}>{c.nombre_comercial}</Text>
                      <Box pr={4}>
                        <Input 
                          size="sm" type="number" 
                          value={form.dist?.[c.id] !== undefined ? form.dist[c.id] : 0}
                          onChange={e => handleChange('dist', { ...form.dist, [c.id]: e.target.value === '' ? '' : Number(e.target.value) })}
                          bg="whiteAlpha.50"
                          borderColor={distTotal !== 100 ? 'red.300' : 'inherit'}
                          _focus={{ borderColor: distTotal !== 100 ? 'red.500' : 'brand.500' }}
                        />
                      </Box>
                      <Flex justify="center">
                        <Checkbox 
                          colorScheme="brand" 
                          isChecked={form.empresa_principal === c.id}
                          onChange={() => handleChange('empresa_principal', c.id)}
                        />
                      </Flex>
                    </SimpleGrid>
                  ))}
                </Box>
              </Box>
            )}

            {/* --- TAB: PERSONAL --- */}
            {tab === 'personal' && (
              <Box>
                <SectionTitle title="Nombres y Apellidos" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5} mb={5}>
                  <Field label="Primer Nombre (Obligatorio)" val={form.primer_nombre} onChange={v => handleChange('primer_nombre', v)} required />
                  <Field label="Segundo Nombre" val={form.segundo_nombre} onChange={v => handleChange('segundo_nombre', v)} />
                  <GridItem colSpan={{ base: 1, sm: 2 }}>
                    <Field label="Otros Nombres" val={form.otro_nombre} onChange={v => handleChange('otro_nombre', v)} />
                  </GridItem>
                  <Field label="Primer Apellido (Obligatorio)" val={form.primer_apellido} onChange={v => handleChange('primer_apellido', v)} required />
                  <Field label="Segundo Apellido" val={form.segundo_apellido} onChange={v => handleChange('segundo_apellido', v)} />
                  <GridItem colSpan={{ base: 1, sm: 2 }}>
                    <Field label="Apellido Casada" val={form.apellido_casada} onChange={v => handleChange('apellido_casada', v)} />
                  </GridItem>
                </SimpleGrid>

                <SectionTitle title="Nacimiento y Estados" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5} mb={5}>
                  <FormControl isRequired>
                    <FormLabel fontSize="11px" mb={1} color={subtitleColor} fontWeight="600" textTransform="uppercase">Fecha de Nacimiento (Obligatorio)</FormLabel>
                    <Input size="sm" type="date" value={form.fecha_nacimiento?.split('T')[0] || ''} onChange={e => handleChange('fecha_nacimiento', e.target.value)} />
                  </FormControl>
                  <Field label="Edad (Obligatorio)" val={form.edad} onChange={v => handleChange('edad', v)} type="number" required />
                  <SelectField label="Estado Civil (Obligatorio)" val={form.estado_civil} onChange={v => handleChange('estado_civil', v)} options={['Casado/a', 'Soltero/a', 'Divorciado/a', 'Viudo/a', 'Unido/a']} required />
                  <SelectField label="Género (Obligatorio)" val={form.genero} onChange={v => handleChange('genero', v)} options={['Hombre', 'Mujer']} required />
                </SimpleGrid>
              </Box>
            )}

            {/* --- TAB: IDENTIDAD --- */}
            {tab === 'identidad' && (
              <Box>
                <SectionTitle title="Documentos e Identidad" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5} mb={5}>
                  <Field label="DPI (Obligatorio)" val={form.dpi} onChange={v => handleChange('dpi', v)} error={duplicateDpi ? 'DPI ya registrado' : null} required />
                  <Field label="Lugar Emisión DPI" val={form.lugar_emision_dpi} onChange={v => handleChange('lugar_emision_dpi', v)} />
                  <Field label="No. IGSS" val={form.no_igss} onChange={v => handleChange('no_igss', v)} error={duplicateIgss ? 'IGSS ya registrado' : null} />
                  <Field label="NIT" val={form.nit} onChange={v => handleChange('nit', v)} />
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5}>
                  <SelectField label="Tipo Licencia" val={form.tipo_licencia} onChange={v => handleChange('tipo_licencia', v)} options={['Carro', 'Moto']} />
                  <SelectField label="Clase Licencia" val={form.clase_licencia} onChange={v => handleChange('clase_licencia', v)} options={['A', 'B', 'C', 'M']} />
                  <Field label="No. Licencia" val={form.licencia} onChange={v => handleChange('licencia', v)} />
                </SimpleGrid>
              </Box>
            )}

            {/* --- TAB: CONTACTO --- */}
            {tab === 'contacto' && (
              <Box>
                <SectionTitle title="Información de Contacto" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5}>
                  <Field label="Teléfono Domiciliar" val={form.telefono} onChange={v => handleChange('telefono', v)} />
                  <Field label="Celular Personal" val={form.telefono_celular} onChange={v => handleChange('telefono_celular', v)} />
                  <Field label="Teléfono Emergencia" val={form.telefono_emergencia} onChange={v => handleChange('telefono_emergencia', v)} />
                  <Field label="Nombre Emergencia" val={form.nombre_emergencia} onChange={v => handleChange('nombre_emergencia', v)} />
                  <GridItem colSpan={{ base: 1, sm: 2 }}>
                    <Field label="Dirección (Obligatorio)" val={form.direccion} onChange={v => handleChange('direccion', v)} required />
                  </GridItem>
                </SimpleGrid>
              </Box>
            )}

            {/* --- TAB: PAGO --- */}
            {tab === 'pago' && (
              <Box>
                <SectionTitle title="Información de Pago" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5} mb={5}>
                  <SelectField label="Tipo de pago (Obligatorio)" val={form.tipo_de_pago} onChange={v => handleChange('tipo_de_pago', v)} options={['Cheque', 'Transferencia']} required />
                  <SelectField label="Banco" val={form.banco} onChange={v => handleChange('banco', v)} options={['Banco Industrial', 'Banco Promerica', 'Banco de Desarrollo Rural']} />
                  <SelectField label="Tipo de Cuenta" val={form.tipo_cuenta} onChange={v => handleChange('tipo_cuenta', v)} options={['Monetaria', 'Ahorro']} />
                  <SelectField label="Moneda (Obligatorio)" val={form.moneda} onChange={v => handleChange('moneda', v)} options={['Quetzal', 'Dolar']} required />
                  <Field label="No. Cuenta" val={form.no_cuenta} onChange={v => handleChange('no_cuenta', v)} />
                </SimpleGrid>
              </Box>
            )}

            {/* --- TAB: CONDICIONES --- */}
            {tab === 'condiciones' && (
              <Box>
                <SectionTitle title="Condiciones Laborales" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5} mb={5}>
                  <SelectField label="Estado Empleado (Obligatorio)" val={form.estado} onChange={v => handleChange('estado', v)} options={['Activo', 'De Baja']} required />
                  <SelectField label="Condición laboral (Obligatorio)" val={form.condicion_laboral} onChange={v => handleChange('condicion_laboral', v)} options={['Temporal', 'Fijo']} required />
                  <FormControl isRequired>
                    <FormLabel fontSize="11px" mb={1} color={subtitleColor} fontWeight="600" textTransform="uppercase">Fecha Inicio (Obligatorio)</FormLabel>
                    <Input size="sm" type="date" value={form.fecha_inicio?.split('T')[0] || ''} onChange={e => handleChange('fecha_inicio', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="11px" mb={1} color={subtitleColor} fontWeight="600" textTransform="uppercase">Fecha Baja</FormLabel>
                    <Input size="sm" type="date" value={form.fecha_baja?.split('T')[0] || ''} onChange={e => handleChange('fecha_baja', e.target.value)} />
                  </FormControl>
                  <SelectField label="Jornada (Obligatorio)" val={form.jornada} onChange={v => handleChange('jornada', v)} options={['Diurna', 'Nocturna']} required />
                  <Field label="Discapacidad" val={form.discapacidad} onChange={v => handleChange('discapacidad', v)} />
                  <Field label="ID Permisos (Obligatorio)" val={form.rol_permisos} onChange={v => handleChange('rol_permisos', v)} type="number" required />
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5}>
                  <FormControl display="flex" alignItems="center" h="100%">
                    <Checkbox isChecked={form.horas_extra} onChange={e => handleChange('horas_extra', e.target.checked)}>
                      <Text fontSize="sm" fontWeight={600} ml={2}>Horas Extra</Text>
                    </Checkbox>
                  </FormControl>
                  <FormControl display="flex" alignItems="center" h="100%">
                    <Checkbox isChecked={form.jubilacion} onChange={e => handleChange('jubilacion', e.target.checked)}>
                      <Text fontSize="sm" fontWeight={600} ml={2}>Jubilación</Text>
                    </Checkbox>
                  </FormControl>
                </SimpleGrid>
              </Box>
            )}

            {/* --- TAB: PLANILLA --- */}
            {tab === 'planilla' && (
              <Box>
                <SectionTitle title="Planilla" />
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
                  <Field label="Sueldo Ordinario (Obligatorio)" type="number" val={form.sueldo_ordinario} onChange={v => handleChange('sueldo_ordinario', v)} required />
                </SimpleGrid>
              </Box>
            )}

            {/* --- TAB: ORIGINARIO --- */}
            {tab === 'origen' && (
              <Box>
                <SectionTitle title="Originario" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5}>
                  <Field label="Nacionalidad (Obligatorio)" val={form.nacionalidad} onChange={v => handleChange('nacionalidad', v)} required />
                  <Field label="Departamento Originario (Obligatorio)" val={form.departamento_originario} onChange={v => handleChange('departamento_originario', v)} required />
                  <Field label="Municipio Originario (Obligatorio)" val={form.municipio_originario} onChange={v => handleChange('municipio_originario', v)} required />
                </SimpleGrid>
              </Box>
            )}

            {/* --- TAB: ARCHIVERO --- */}
            {tab === 'archivero' && (
              <Box>
                <SectionTitle title="Educación" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5} mb={5}>
                  <FormControl display="flex" alignItems="center"><Checkbox isChecked={form.primaria} onChange={e => handleChange('primaria', e.target.checked)}><Text fontSize="sm" fontWeight={600} ml={2}>Primaria</Text></Checkbox></FormControl>
                  <Field label="Grado Primaria" val={form.grado_primaria} onChange={v => handleChange('grado_primaria', v)} type="number" />
                  <FormControl display="flex" alignItems="center"><Checkbox isChecked={form.secundaria} onChange={e => handleChange('secundaria', e.target.checked)}><Text fontSize="sm" fontWeight={600} ml={2}>Secundaria</Text></Checkbox></FormControl>
                  <Field label="Grado Secundaria" val={form.grado_secundaria} onChange={v => handleChange('grado_secundaria', v)} type="number" />
                  <FormControl display="flex" alignItems="center"><Checkbox isChecked={form.diversificado} onChange={e => handleChange('diversificado', e.target.checked)}><Text fontSize="sm" fontWeight={600} ml={2}>Diversificado</Text></Checkbox></FormControl>
                  <FormControl display="flex" alignItems="center"><Checkbox isChecked={form.universidad} onChange={e => handleChange('universidad', e.target.checked)}><Text fontSize="sm" fontWeight={600} ml={2}>Universidad</Text></Checkbox></FormControl>
                </SimpleGrid>

                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('estudio').length} estudio(s)</Text>
                  <Button size="xs" colorScheme="brand" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('estudio'); setEditingRecord(null); }}>Agregar Estudio</Button>
                </Flex>
                {showRecordForm === 'estudio' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'div_universidad', label: 'Div / Universidad', type: 'select', options: ['Diversificado', 'Universidad'] },
                      { key: 'nombre_carrera', label: 'Nombre de la carrera' },
                      { key: 'descripcion', label: 'Descripción' },
                      { key: 'mes', label: 'Mes', type: 'number' },
                      { key: 'ano', label: 'Año', type: 'number' },
                      { key: 'diploma', label: 'Diploma', type: 'checkbox' },
                      { key: 'reembolsar', label: 'Reembolsar' },
                      { key: 'obligacion', label: 'Obligación', type: 'checkbox' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => handleRecordSave('estudio', data)}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('estudio')}
                  columns={[
                    { key: 'div_universidad', label: 'Div / Universidad' },
                    { key: 'nombre_carrera', label: 'Carrera' },
                    { key: 'descripcion', label: 'Descripción' },
                    { key: 'diploma', label: 'Diploma', render: d => d?.diploma ? 'Sí' : 'No' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('estudio'); }}
                />

                <SectionTitle title="Cursos" />
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('curso').length} curso(s)</Text>
                  <Button size="xs" colorScheme="brand" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('curso'); setEditingRecord(null); }}>Agregar Curso</Button>
                </Flex>
                {showRecordForm === 'curso' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'fecha_capacitacion', label: 'Fecha Capacitación (OBLIGATORIO)', type: 'date' },
                      { key: 'codigo_curso', label: 'Código Curso' },
                      { key: 'nombre_curso', label: 'Nombre del curso (OBLIGATORIO)' },
                      { key: 'funciones_especificas', label: 'Funciones específicas', type: 'checkbox' },
                      { key: 'induccion_bpms', label: 'Inducción BPMS', type: 'checkbox' },
                      { key: 'general', label: 'General', type: 'checkbox' },
                      { key: 'fecha_evaluacion', label: 'Fecha Evaluación', type: 'date' },
                      { key: 'nota', label: 'Nota', type: 'number' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => {
                       if(!data.fecha_capacitacion || !data.nombre_curso) { alert('Fecha y Nombre del curso son obligatorios.'); return; }
                       handleRecordSave('curso', data);
                    }}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('curso')}
                  columns={[
                    { key: 'fecha_capacitacion', label: 'Fecha' },
                    { key: 'codigo_curso', label: 'Código' },
                    { key: 'nombre_curso', label: 'Curso' },
                    { key: 'nota', label: 'Nota' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('curso'); }}
                />

                <SectionTitle title="Puestos (Historial interno)" />
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('puesto').length} puesto(s)</Text>
                  <Button size="xs" colorScheme="brand" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('puesto'); setEditingRecord(null); }}>Agregar Puesto</Button>
                </Flex>
                {showRecordForm === 'puesto' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'fecha', label: 'Fecha', type: 'date' },
                      { key: 'codigo_departamento', label: 'Código Departamento' },
                      { key: 'departamento', label: 'Departamento' },
                      { key: 'codigo_puesto', label: 'Código Puesto' },
                      { key: 'puesto', label: 'Puesto' },
                      { key: 'motivo', label: 'Motivo' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => handleRecordSave('puesto', data)}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('puesto')}
                  columns={[
                    { key: 'fecha', label: 'Fecha' },
                    { key: 'departamento', label: 'Departamento' },
                    { key: 'puesto', label: 'Puesto' },
                    { key: 'motivo', label: 'Motivo' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('puesto'); }}
                />

                <SectionTitle title="Eventos" />
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('evento').length} evento(s)</Text>
                  <Button size="xs" colorScheme="brand" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('evento'); setEditingRecord(null); }}>Agregar Evento</Button>
                </Flex>
                {showRecordForm === 'evento' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'tipo', label: 'Tipo (OBLIGATORIO)' },
                      { key: 'numero', label: 'Número (OBLIGATORIO)' },
                      { key: 'del', label: 'Del (Fecha - OBLIGATORIO)', type: 'date' },
                      { key: 'al', label: 'Al (Fecha - OBLIGATORIO)', type: 'date' },
                      { key: 'ano', label: 'Año (OBLIGATORIO)', type: 'number' },
                      { key: 'mes', label: 'Mes (OBLIGATORIO)', type: 'number' },
                      { key: 'dia', label: 'Día (OBLIGATORIO)', type: 'number' },
                      { key: 'hora', label: 'Hora (OBLIGATORIO)', type: 'number' },
                      { key: 'minuto', label: 'Minuto (OBLIGATORIO)', type: 'number' },
                      { key: 'procesar', label: 'Procesar (OBLIGATORIO)' },
                      { key: 'planilla', label: 'Planilla (OBLIGATORIO)' },
                      { key: 'estado', label: 'Estado (OBLIGATORIO)' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => {
                       if(!data.tipo || !data.numero || !data.del || !data.al || !data.ano || !data.mes || !data.dia || !data.hora || !data.minuto || !data.procesar || !data.planilla || !data.estado) {
                         alert('Todos los campos son obligatorios.'); return;
                       }
                       handleRecordSave('evento', data);
                    }}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('evento')}
                  columns={[
                    { key: 'tipo', label: 'Tipo' },
                    { key: 'numero', label: 'Número' },
                    { key: 'del', label: 'Del' },
                    { key: 'al', label: 'Al' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('evento'); }}
                />
              </Box>
            )}

`;

// We need to replace everything from:
// `          <Box flex={1} overflowY="auto" p={6} css={{ '&::-webkit-scrollbar': { width: '8px' }, '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-whiteAlpha-300)', borderRadius: '10px' } }}>`
// down to 
// `          </Box>\n        </Flex>\n      </ModalContent>\n    </Modal>\n  );\n}`

const startMarker = "          <Box flex={1} overflowY=\"auto\" p={6} css={{ '&::-webkit-scrollbar': { width: '8px' }, '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-whiteAlpha-300)', borderRadius: '10px' } }}>";

const parts = content.split(startMarker);
if (parts.length === 2) {
  let endMarkerIndex = parts[1].lastIndexOf("          </Box>");
  if (endMarkerIndex !== -1) {
    let newBottom = "          </Box>\n" + parts[1].substring(endMarkerIndex + 17);
    let finalContent = parts[0] + startMarker + newTabsContent + newBottom;
    fs.writeFileSync(file, finalContent);
    console.log('Update success');
  } else {
    console.log('Could not find end marker');
  }
} else {
  console.log('Could not find start marker');
}
