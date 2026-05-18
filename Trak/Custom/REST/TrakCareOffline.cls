Class Custom.REST.TrakCareOffline Extends %CSP.REST
{

XData UrlMap [ XMLNamespace = "http://www.intersystems.com/urlmap" ]
{
<Routes>
	<Route Url="/hl7inbound" Method="POST" Call="HL7Inbound" Cors="false" />
	<Route Url="/getData" Method="GET" Call="getData" Cors="false" />
	<Route Url="/getDataTest" Method="GET" Call="getDataTest" Cors="false" />
</Routes>
}

ClassMethod HL7Inbound() As %Status
{
	// RBV ini Logs temporales para debug
	#define logRBV(%x,%y) set ^zRBV($increment(^zRBV),$ZDT($H,3,1),$zname,$piece($STACK($STACK,"PLACE"),"+",1),%x) = %y
	// RBV fin Logs temporales para debug

	$$$logRBV("Inicio hl7inbound", "-----------------------------")

    set sc = $$$OK
	set mrnPaciente = ""
	set episodio = ""
	set idNotaClinica = ""

	set postData = {}.%FromJSON(%request.Content)

	// Leer HL7 y normalizar terminadores de segmento
    set tHL7String = postData.msg

	$$$logRBV("msg", tHL7String)
	set HL7String = $zconvert(tHL7String,"O","UTF8")
	$$$logRBV("msg", HL7String)

	// char(10) = \n
	// char(13) = \r

    set tHL7String = $Replace(tHL7String,$char(13)_$char(10),$char(13))
    set tHL7String = $Replace(tHL7String,$char(10),"<br>")
    set tHL7String = $Replace(tHL7String,$char(13),$char(10))

	// Persear el HL7 como un object EnsLib.HL7.Message
    set inboundHL7 = ##class(EnsLib.HL7.Message).ImportFromString(tHL7String,.sc) quit:$$$ISERR(sc) $System.Status.DisplayError(sc)
    set version   = inboundHL7.GetValueAt("1:12",,.sc)  quit:$$$ISERR(sc) $System.Status.DisplayError(sc)
    set msgType   = inboundHL7.GetValueAt("1:9.1",,.sc) quit:$$$ISERR(sc) $System.Status.DisplayError(sc)
    set trigger   = inboundHL7.GetValueAt("1:9.2",,.sc) quit:$$$ISERR(sc) $System.Status.DisplayError(sc)
    set structure = inboundHL7.GetValueAt("1:9.3",,.sc) quit:$$$ISERR(sc) $System.Status.DisplayError(sc)
	set docTypeInboundHL7 = version_":"_msgType_"_"_trigger

	//$$$logRBV("docTypeInboundHL7", docTypeInboundHL7)
	//$$$logRBV("structure", structure)

	set respuesta = {}

	try {
		if (docTypeInboundHL7 = "2.5.1:ADT_A28") {
			set sc = inboundHL7.PokeDocType("2.5.1:ADT_A05") return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set sc = inboundHL7.BuildMap() return:$$$ISERR(sc) $System.Status.DisplayError(sc)

			set nombres = inboundHL7.GetValueAt("PID:5.2")
			set apellidoPaterno = inboundHL7.GetValueAt("PID:5.1")
			set apellidoMaterno = inboundHL7.GetValueAt("PID:5.3")
			set dob = inboundHL7.GetValueAt("PID:DateTimeOfBirth.time")
			set dob = $extract(dob,7,8)_"/"_$extract(dob,5,6)_"/"_$extract(dob,1,4)
			set sex = inboundHL7.GetValueAt("PID:AdministrativeSex")
			if (sex = "M") set sex = "Hombre"
			if (sex = "F") set sex = "Mujer"
			set id1 = inboundHL7.GetValueAt("PID:3(1)") // OFFP1953
			set id2 = inboundHL7.GetValueAt("PID:4(1)") // 194-2

			$$$logRBV("Nombres: ", nombres)
			$$$logRBV("Apellido Paterno:", apellidoPaterno)
			$$$logRBV("Apellido Materno:", apellidoMaterno)
			$$$logRBV("Fecha de Nacimiento:", dob)
			$$$logRBV("Sexo:", sex)
			$$$logRBV("id1:", id1)
			$$$logRBV("id2:", id2)

			set api = ##class(TC.api.PAPerson.Edit).%New()
			set api.TUSERNAME = "demo"
			set api.TPASSWORD = "demodemo"
			set api.PAPERID = id2 // RUT
			set api.PAPERExternalOIDs = id1
			set api.CTSEXDesc = sex
			set api.PAPERDob = dob
			set api.PAPERName = apellidoPaterno
			set api.PAPERName2 = nombres
			set api.PAPERName3 = apellidoMaterno
			set api.EthnicityStringHidden = 2 // Es un dato obligatorio para la API
			
			//set idTipoPaciente = ##class(web.PACPatientType).GetIdFromCodeOrDescription("Identificable")
			//if (idTipoPaciente) {
			//	set api.PTYPEDesc = "Identificable"
			//}
			
			//set api.CTNATDesc = ""
			//set api.PAPERMobPhone = objPaciente.celular
			//set api.PAPEREmail = objPaciente.email
			
			set ret = api.Save()
			
			if (ret) {
				set respuesta.estado = "OK"
				set patientId = api.ID
				set mrnPaciente = ##class(User.PAPatMas).%OpenId(patientId).PAPMINo
				set respuesta.enctid = ""
				set respuesta.pid = mrnPaciente
			} else {
				set respuesta.estado = "NOK"
				set respuesta.reason = ret
				set respuesta.enctid = ""
				set respuesta.pid = ""
			}

		} elseif (docTypeInboundHL7 = "2.5.1:ADT_A01") {
			set sc = inboundHL7.PokeDocType(docTypeInboundHL7) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set sc = inboundHL7.BuildMap() return:$$$ISERR(sc) $System.Status.DisplayError(sc)

			// Obtenemos información del HL7
			set mrnPaciente = inboundHL7.GetValueAt("PID:3(1)", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set episodeType = inboundHL7.GetValueAt("PV1:2", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set local = inboundHL7.GetValueAt("PV1:3.1", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			//set local = $zconvert(local,"I","UTF8")
			set visitNumber = inboundHL7.GetValueAt("PV1:19", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set episodeDateTime = inboundHL7.GetValueAt("PV1:45", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set fechaEpisodio = $extract(episodeDateTime,7,8)_"/"_$extract(episodeDateTime,5,6)_"/"_$extract(episodeDateTime,1,4)
			set horaEpisodio = $extract(episodeDateTime,9,10)_":"_$extract(episodeDateTime,11,12)_":"_$extract(episodeDateTime,13,14)
			set motivoConsulta = inboundHL7.GetValueAt("PV2:3.1", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)

			$$$logRBV("mrnPaciente", mrnPaciente)
			$$$logRBV("episodeType", episodeType)
			$$$logRBV("local", local)
			$$$logRBV("visitNumber", visitNumber)
			$$$logRBV("fechaEpisodio", fechaEpisodio)
			$$$logRBV("horaEpisodio", horaEpisodio)
			$$$logRBV("motivoConsulta", motivoConsulta)

			// Obtenemos información adicional
			set patientId = ##class(web.PAPatMas).GetIdFromCodeOrDescription(mrnPaciente)
			$$$logRBV("patientId", patientId)

			// Llamamos al API TrakCare para crear un Episodio (PAAdm) con los datos del HL7
			set api = ##class(TC.api.PAAdm.Edit).%New()
			
			set api.TUSERNAME = "demo"
			set api.TPASSWORD = "demodemo"
			set api.PAADMType = episodeType
			set api.PatientID = patientId
			set api.CTLOCDesc = local
			set api.PAADMVisitStatus = "Admit"
			set api.PAADMVerified = "No"
			set api.PAADMConfidential = "No"
			
			set ret = api.Save()

			if (ret) {
				set respuesta.estado = "OK"
				set respuesta.enctid = ##class(web.PAAdm).GetEpNumberFromId(api.ID)
				set mrnPaciente = ##class(User.PAPatMas).%OpenId(patientId).PAPMINo
				set respuesta.pid = mrnPaciente
			} else {
				set respuesta.estado = "NOK"
				set respuesta.reason = ret
				set respuesta.enctid = ""
				set respuesta.pid = ""
			}

		} elseif (docTypeInboundHL7 = "2.5.1:ORU_R01") {
			set sc = inboundHL7.PokeDocType("2.5.1:ORU_R01") return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set sc = inboundHL7.BuildMap() return:$$$ISERR(sc) $System.Status.DisplayError(sc)

			// Obtenemos información del HL7
			set mrnPaciente = inboundHL7.GetValueAt("PIDgrpgrp(1).PIDgrp.PID:3(1).1", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set episodio = inboundHL7.GetValueAt("PIDgrpgrp(1).PIDgrp.PV1grp.PV1:19(1).1", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set profesional = inboundHL7.GetValueAt("PIDgrpgrp(1).ORCgrp(1).OBR:32.1", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set notaOBX = inboundHL7.GetValueAt("PIDgrpgrp(1).ORCgrp(1).OBXgrp(1).OBX:5", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set obr4Codigo = inboundHL7.GetValueAt("PIDgrpgrp(1).ORCgrp(1).OBR:4.1", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set orb4Description = inboundHL7.GetValueAt("PIDgrpgrp(1).ORCgrp(1).OBR:4.2", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set fechaHoraOBR = inboundHL7.GetValueAt("PIDgrpgrp(1).ORCgrp(1).OBR:7", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
			set fechaOBR = $extract(fechaHoraOBR,7,8)_"/"_$extract(fechaHoraOBR,5,6)_"/"_$extract(fechaHoraOBR,1,4)
			set horaOBR = $extract(fechaHoraOBR,9,10)_":"_$extract(fechaHoraOBR,11,12)_":"_$extract(fechaHoraOBR,13,14)

			$$$logRBV("mrnPaciente", mrnPaciente)
			$$$logRBV("episodio", episodio)
			$$$logRBV("profesional", profesional)
			$$$logRBV("notaOBX", notaOBX)
			$$$logRBV("obr4Codigo", obr4Codigo)
			$$$logRBV("orb4Description", orb4Description)
			$$$logRBV("fechaHoraOBR", fechaHoraOBR)
			$$$logRBV("fechaOBR", fechaOBR)
			$$$logRBV("horaOBR", horaOBR)

			// Obtenemos información adicional
			set episodeID = ##class(web.PAAdm).GetIdFromEpisodeNo(episodio)
			set mrAdm = ##class(web.PAAdm).GetMRAdm(episodeID)

			$$$logRBV("episodeID", episodeID)
			$$$logRBV("mrAdm", mrAdm)

			// Llamamos al API TrakCare para crear una Nota Clínica (MRNursingNotes) con los datos del HL7
			set api = ##class(TC.api.MRNursingNotes.Edit).%New()
			set api.TUSERNAME = "demo"
			set api.TPASSWORD = "demodemo"
			set api.PARREF = mrAdm
			set api.NOTNurseIdDR = profesional
			set api.CLNOTCATDesc = "Nota de Evolución"
			set api.CNTDesc = "TrakCare Offline"
			set api.NNSDesc = "Autorizado"
			set api.NOTActivityDate = fechaOBR
			set api.NOTActivityTime = horaOBR
			set api.NOTNotes = notaOBX
			set api.NOTNotesSave = notaOBX
			set api.NOTComments1 = "Creada por TrakCare Offline"
			
			set ret = api.Save()
			
			if (ret) {
				set respuesta.estado = "OK"
				set respuesta.idNotaClinica = api.ID
				set respuesta.enctid = episodio
				set respuesta.pid = mrnPaciente
			} else {
				set respuesta.estado = "NOK"
				set respuesta.reason = ret
				set respuesta.idNotaClinica = ""
				set respuesta.enctid = ""
				set respuesta.pid = ""
			}
		}
	} catch ex {
	    return ex.AsStatus()
	}

	set %response.ContentType="application/json; charset=UTF-8"
	write $zconvert(respuesta.%ToJSON(),"O","UTF8")

	$$$logRBV("Fin    hl7inbound", "-----------------------------")

    quit $$$OK
}

ClassMethod getData() As %Status
{
	// RBV ini Logs temporales para debug
	#define logRBV(%x,%y) set ^zRBV($increment(^zRBV),$ZDT($H,3,1),$zname,$piece($STACK($STACK,"PLACE"),"+",1),%x) = %y
	// RBV fin Logs temporales para debug

	set tSC = $$$OK
	set resp = []

	// Obtenemos la informacion de los parametros
	// obtenerDatos?usuario=11111111-1
	// obtenerDatos?local=00001
	// obtenerDatos?tipo=O [O = Outpatient, I = Inpatient, E = Emergency]
	set profesional = $get(%request.Data("profesional",1))

	set local = $get(%request.Data("local",1))
	set local = ##class(web.CTLoc).GetIdFromCodeOrDescription(local)

	set tipo = $get(%request.Data("tipo",1))

	set mrn = $get(%request.Data("mrn",1))

	set fechaInicio = $zdateh("2026-01-01",3)

	try {
		// Definir la query
		&sql(DECLARE C1 CURSOR FOR 
			select %nolock
			pa.PAADM_RowID "idEpisodio",
			pa.PAADM_PAPMI_DR "idPaciente",
			ma.MRADM_RowId "idEncuentro",
			nvl(pa.PAADM_PAPMI_DR->PAPMI_Name2,'') || ', ' || nvl(pa.PAADM_PAPMI_DR->PAPMI_Name,'') || ' ' || nvl(pa.PAADM_PAPMI_DR->PAPMI_Name3,'') "Paciente",
			pa.PAADM_PAPMI_DR->PAPMI_No "MRN",
			pa.PAADM_PAPMI_DR->PAPMI_Id "RUN",
			pa.PAADM_PAPMI_DR->PAPMI_DOB "FechaNacimiento",
			pa.PAADM_PAPMI_DR->PAPMI_Sex_DR->CTSEX_Desc "Sexo",
			decode(pa.PAADM_Type, 'O', 'Ambulatorio', 'E', 'Urgencia', 'I', 'Hospitalizado') "Tipo",
			pa.PAADM_AdmDate "FechaAtencion",
			pa.PAADM_AdmTime "HoraAtencion",
			pa.PAADM_ADMNo "NumEpisodio",
			pa.PAADM_Hospital_DR->HOSP_Desc "Hospital",
			pa.PAADM_DepCode_DR->CTLOC_Desc "Local",
			pa.PAADM_CurrentRoom_DR->ROOM_Desc "Habitacion",
			pa.PAADM_CurrentBed_DR->BED_Code "Cama",
			decode(pa.PAADM_VisitStatus,'A','Actual','C','Cancelado','D','Egreso','P','Pre-Admision','R','Released','N','DNA') "Estado",
			pa.PAADM_AdmDocCodeDR->CTPCP_Desc "Profesional",
			ma.MRADM_PresentComplaint "MotivoConsulta",
			'' "fin"
			from SQLUser.PA_Adm pa
			left join SQLUser.MR_Adm ma on pa.PAADM_RowID = ma.MRADM_ADM_DR
			left join SQLUser.MR_Encounter me on ma.MRADM_RowId = me.ENC_MRAdm_DR
			where 1 = 1
			and pa.PAADM_AdmDate > :fechaInicio
			and (:mrn is null OR pa.PAADM_PAPMI_DR->PAPMI_No = :mrn)
			and (:tipo is null OR pa.PAADM_Type = :tipo)
			--and (:local is null OR pa.PAADM_DepCode_DR = :local)
			--and pa.PAADM_RowId = 18 -- Este paciente tiene resultados
			and pa.PAADM_VisitStatus not in ('C','P','D')
			order by pa.PAADM_AdmDate desc, pa.PAADM_AdmTime desc
		)

		// Abrir el cursor
		&sql(OPEN C1)
		if (SQLCODE '= 0) {
			$$$logRBV("Error al abrir cursor. SQLCODE=", SQLCODE)
			quit
		}

		// Ejecutar la logica por cada fila
		for {
			// Inicializar variables
			set idEpisodio = "",
				idPaciente = "",
				idEncuentro = "",
				nombre = "",
				mrn = "",
				run = "",
				fechaNacimiento = "",
				sexo = "",
				tipo = "",
				fechaAtencion = "",
				horaAtencion = "",
				numEpisodio = "",
				hospital = "",
				local = "",
				habitacion = "",
				cama = "",
				estado = "",
				profesional = "",
				motivoConsulta = ""

			// Hacer el fetch
			&sql(FETCH C1 INTO
				:idEpisodio,
				:idPaciente,
				:idEncuentro,
				:nombre,
				:mrn,
				:run,
				:fechaNacimiento,
				:sexo,
				:tipo,
				:fechaAtencion,
				:horaAtencion,
				:numEpisodio,
				:hospital,
				:local,
				:habitacion,
				:cama,
				:estado,
				:profesional,
				:motivoConsulta,
				:fin)

			// Manejar errores
			if (SQLCODE<0) {
				$$$logRBV("Error al hacer fetch. SQLCODE=", SQLCODE)
				&sql(CLOSE C1)
				quit
			}
			if (SQLCODE=100) {
				&sql(CLOSE C1)
				quit // No hay más registros
			}

			set alergias = []
			set tSC = ..ObtenerAlergias(idPaciente, .alergias)
			if (tSC '= $$$OK) $$$logRBV("tSC ObtenerAlergias", $System.Status.GetErrorText(tSC))

			// Iterar en cada uno de los 3 ultimos encuentros del paciente
			set encuentros = []
			set tSC = ..ObtenerEncuentros(idPaciente, idEpisodio, .encuentros)
			if (tSC '= $$$OK) $$$logRBV("tSC ObtenerEncuentros", $System.Status.GetErrorText(tSC))

			set resultados = []
			set tSC = ..ObtenerResultados(idEpisodio, .resultados)
			if (tSC '= $$$OK) $$$logRBV("tSC ObtenerResultados", $System.Status.GetErrorText(tSC))

			set registrosOffline = []
			set tSC = ..ObtenerNotasOffline(idEncuentro, .registrosOffline)
			if (tSC '= $$$OK) $$$logRBV("tSC ObtenerNotasOffline", $System.Status.GetErrorText(tSC))

			do resp.%Push(
				{
					"Nombre": (nombre),
					"MRN": (mrn),
					"RUN": (run),
					"FechaNacimiento": ($zdate(fechaNacimiento,3)),
					"Sexo": (sexo),
					"Tipo": (tipo),
					"FechaAtencion": ($zdate(fechaAtencion,3)_" "_$ztime(horaAtencion,1)),
					"NumEpisodio": (numEpisodio),
					"Estado": (estado),
					"Hospital": (hospital),
					"Local": (local),
					"Habitacion": (habitacion),
					"Cama": (cama),
					"Profesional": (profesional),
					"MotivoConsulta": (motivoConsulta),
					"Antecedentes": {
						"Alergias": (alergias),
						"Encuentros": (encuentros),
						"Resultados": (resultados),
						"RegistrosOffline": (registrosOffline)
					}
				}
			)
		}

		&sql(CLOSE C1)

	} catch ex {
		set tSC = ex.AsStatus()
		&sql(CLOSE C1)
		$$$logRBV("tSC ObtenerDatos", $System.Status.GetErrorText(tSC))
		set resp.estado = "NOK"
		set resp.mensaje = tSC
	}

    set %response.ContentType="application/json; charset=utf-8"
    set %response.CharSet="utf-8"
    set tStream=##class(%Stream.TmpCharacter).%New()
    do resp.%ToJSON(tStream)
    do tStream.OutputToDevice()

	return tSC
}

ClassMethod getDataTest() As %Status
{
	// RBV ini Logs temporales para debug
	#define logRBV(%x,%y) set ^zRBV($increment(^zRBV),$ZDT($H,3,1),$zname,$piece($STACK($STACK,"PLACE"),"+",1),%x) = %y
	// RBV fin Logs temporales para debug

	$$$logRBV("Inicio ObtenerDatosTest", "-----------------------------")
	set tSC = $$$OK
	set resp = []

	// Obtenemos la informacion de los parametros
	// obtenerDatos?usuario=11111111-1
	// obtenerDatos?local=00001
	// obtenerDatos?tipo=O [O = Outpatient, I = Inpatient, E = Emergency]
	set profesional = $get(%request.Data("profesional",1))
	$$$logRBV("profesional", profesional)

	set local = $get(%request.Data("local",1))
	set local = ##class(web.CTLoc).GetIdFromCodeOrDescription(local)

	set tipo = $get(%request.Data("tipo",1))
	$$$logRBV("tipo", tipo)

	set mrn = $get(%request.Data("mrn",1))

	set fechaInicio = $zdateh("2026-01-01",3)

	try {
		// Definir la query
		&sql(DECLARE C1 CURSOR FOR 
			select %nolock
			pa.PAADM_RowID "idEpisodio",
			pa.PAADM_PAPMI_DR "idPaciente",
			ma.MRADM_RowId "idEncuentro",
			nvl(pa.PAADM_PAPMI_DR->PAPMI_Name2,'') || ', ' || nvl(pa.PAADM_PAPMI_DR->PAPMI_Name,'') || ' ' || nvl(pa.PAADM_PAPMI_DR->PAPMI_Name3,'') "Paciente",
			pa.PAADM_PAPMI_DR->PAPMI_No "MRN",
			pa.PAADM_PAPMI_DR->PAPMI_Id "RUN",
			pa.PAADM_PAPMI_DR->PAPMI_DOB "FechaNacimiento",
			pa.PAADM_PAPMI_DR->PAPMI_Sex_DR->CTSEX_Desc "Sexo",
			decode(pa.PAADM_Type, 'O', 'Ambulatorio', 'E', 'Urgencia', 'I', 'Hospitalizado') "Tipo",
			pa.PAADM_AdmDate "FechaAtencion",
			pa.PAADM_AdmTime "HoraAtencion",
			pa.PAADM_ADMNo "NumEpisodio",
			pa.PAADM_Hospital_DR->HOSP_Desc "Hospital",
			pa.PAADM_DepCode_DR->CTLOC_Desc "Local",
			pa.PAADM_CurrentRoom_DR->ROOM_Desc "Habitacion",
			pa.PAADM_CurrentBed_DR->BED_Code "Cama",
			decode(pa.PAADM_VisitStatus,'A','Actual','C','Cancelado','D','Egreso','P','Pre-Admision','R','Released','N','DNA') "Estado",
			pa.PAADM_AdmDocCodeDR->CTPCP_Desc "Profesional",
			ma.MRADM_PresentComplaint "MotivoConsulta",
			'' "fin"
			from SQLUser.PA_Adm pa
			left join SQLUser.MR_Adm ma on pa.PAADM_RowID = ma.MRADM_ADM_DR
			left join SQLUser.MR_Encounter me on ma.MRADM_RowId = me.ENC_MRAdm_DR
			where 1 = 1
			and pa.PAADM_AdmDate > :fechaInicio
			and (:mrn is null OR pa.PAADM_PAPMI_DR->PAPMI_No = :mrn)
			and (:tipo is null OR pa.PAADM_Type = :tipo)
			--and (:local is null OR pa.PAADM_DepCode_DR = :local)
			--and pa.PAADM_RowId = 18
			--and pa.PAADM_PAPMI_DR = 100
			and pa.PAADM_VisitStatus not in ('C','P','D')
			order by pa.PAADM_AdmDate desc, pa.PAADM_AdmTime desc
		)

		// Abrir el cursor
		&sql(OPEN C1)
		$$$logRBV("SQLCODE despues de abrir cursor", SQLCODE)
		if (SQLCODE '= 0) {
			$$$logRBV("Error al abrir cursor. SQLCODE=", SQLCODE)
			quit
		}

		// Ejecutar la logica por cada fila
		for {
			// Inicializar variables
			set idEpisodio = "",
				idPaciente = "",
				idEncuentro = "",
				nombre = "",
				mrn = "",
				run = "",
				fechaNacimiento = "",
				sexo = "",
				tipo = "",
				fechaAtencion = "",
				horaAtencion = "",
				numEpisodio = "",
				hospital = "",
				local = "",
				habitacion = "",
				cama = "",
				estado = "",
				profesional = "",
				motivoConsulta = ""

			// Hacer el fetch
			&sql(FETCH C1 INTO
				:idEpisodio,
				:idPaciente,
				:idEncuentro,
				:nombre,
				:mrn,
				:run,
				:fechaNacimiento,
				:sexo,
				:tipo,
				:fechaAtencion,
				:horaAtencion,
				:numEpisodio,
				:hospital,
				:local,
				:habitacion,
				:cama,
				:estado,
				:profesional,
				:motivoConsulta,
				:fin)
			$$$logRBV("SQLCODE despues de fetch", SQLCODE)

			// Manejar errores
			if (SQLCODE<0) {
				$$$logRBV("Error al hacer fetch. SQLCODE=", SQLCODE)
				&sql(CLOSE C1)
				quit
			}
			if (SQLCODE=100) {
				&sql(CLOSE C1)
				quit // No hay más registros
			}

			// Ejecutar logica por cada fila
			$$$logRBV("Datos Paciente y Episodio", nombre_" - "_numEpisodio_" - "_tipo_" - "_idEpisodio)

			set alergias = []
			set tSC = ..ObtenerAlergias(idPaciente, .alergias)
			if (tSC '= $$$OK) $$$logRBV("tSC ObtenerAlergias", $System.Status.GetErrorText(tSC))

			// Iterar en cada uno de los 3 ultimos encuentros del paciente
			set encuentros = []
			set tSC = ..ObtenerEncuentros(idPaciente, idEpisodio, .encuentros)
			if (tSC '= $$$OK) $$$logRBV("tSC ObtenerEncuentros", $System.Status.GetErrorText(tSC))

			set resultados = []
			set tSC = ..ObtenerResultados(idEpisodio, .resultados)
			if (tSC '= $$$OK) $$$logRBV("tSC ObtenerResultados", $System.Status.GetErrorText(tSC))

			set registrosOffline = []
			$$$logRBV("ObtenerNotasOffline", "idEpisodio: "_idEpisodio)
			$$$logRBV("ObtenerNotasOffline", "idEncuentro: "_idEncuentro)
			set tSC = ..ObtenerNotasOffline(idEncuentro, .registrosOffline)
			if (tSC '= $$$OK) $$$logRBV("tSC ObtenerNotasOffline", $System.Status.GetErrorText(tSC))

			do resp.%Push(
				{
					"Nombre": (nombre),
					"MRN": (mrn),
					"RUN": (run),
					"FechaNacimiento": ($zdate(fechaNacimiento,3)),
					"Sexo": (sexo),
					"Tipo": (tipo),
					"FechaAtencion": ($zdate(fechaAtencion,3)_" "_$ztime(horaAtencion,1)),
					"NumEpisodio": (numEpisodio),
					"Estado": (estado),
					"Hospital": (hospital),
					"Local": (local),
					"Habitacion": (habitacion),
					"Cama": (cama),
					"Profesional": (profesional),
					"MotivoConsulta": (motivoConsulta),
					"Antecedentes": {
						"Alergias": (alergias),
						"Encuentros": (encuentros),
						"Resultados": (resultados),
						"RegistrosOffline": (registrosOffline)
					}
				}
			)
		}

		&sql(CLOSE C1)

	} catch ex {
		set tSC = ex.AsStatus()
		&sql(CLOSE C1)
		$$$logRBV("tSC ObtenerDatos", $System.Status.GetErrorText(tSC))
		set resp.estado = "NOK"
		set resp.mensaje = tSC
	}

    set %response.ContentType="application/json; charset=utf-8"
    write $zconvert(resp.%ToJSON(),"O","UTF8")

	$$$logRBV("Fin    ObtenerDatosTest", "-----------------------------")

	return tSC
}

ClassMethod ObtenerEncuentros(idPaciente As %Integer, idEpisodioActual As %Integer, Output encuentros As %DynamicArray) As %Status
{
	// RBV ini Logs temporales para debug
	#define logRBV(%x,%y) set ^zRBV($increment(^zRBV),$ZDT($H,3,1),$zname,$piece($STACK($STACK,"PLACE"),"+",1),%x) = %y
	// RBV fin Logs temporales para debug

	//$$$logRBV("ObtenerEncuentros", "idPaciente: "_idPaciente_" - idEpisodioActual: "_idEpisodioActual)

	set tSC = $$$OK
	set fechaInicio = $zdateh("2025-01-01",3)

	try {
		
		// Definir la query
		&sql(DECLARE C2 CURSOR FOR 
			select %nolock top 3
			pa.PAADM_RowID "idEpisodio",
			pa.PAADM_PAPMI_DR "idPaciente",
			ma.MRADM_RowId "idEncuentro",
			decode(pa.PAADM_Type, 'O', 'Ambulatorio', 'E', 'Urgencia', 'I', 'Hospitalizado','') "Tipo",
			pa.PAADM_AdmDate "FechaAtencion",
			pa.PAADM_AdmTime "HoraAtencion",
			pa.PAADM_ADMNo "NumEpisodio",
			pa.PAADM_CurrentRoom_DR->ROOM_Desc "Habitacion",
			pa.PAADM_CurrentBed_DR->BED_Code "Cama",
			decode(pa.PAADM_VisitStatus,'A','Actual','C','Cancelado','D','Egreso','P','Pre-Admision','R','Released','N','DNA','') "Estado",
			pa.PAADM_AdmDocCodeDR->CTPCP_Desc "Profesional",
			ma.MRADM_PresentComplaint "MotivoConsulta",
			'' "fin"
			from SQLUser.PA_Adm pa
			left join SQLUser.MR_Adm ma on pa.PAADM_RowID = ma.MRADM_ADM_DR
			left join SQLUser.MR_Encounter me on ma.MRADM_RowId = me.ENC_MRAdm_DR
			where 1 = 1
			--and pa.PAADM_AdmDate > :fechaInicio
			and pa.PAADM_PAPMI_DR = :idPaciente
			and pa.PAADM_RowID != :idEpisodioActual
			--and pa.PAADM_VisitStatus not in ('C','P')
			order by pa.PAADM_AdmDate desc, pa.PAADM_AdmTime desc
		)

		// Abrir el cursor
		&sql(OPEN C2)
		if (SQLCODE '= 0) {
			$$$logRBV("Error al abrir cursor. SQLCODE=", SQLCODE)
			quit
		}

		// Ejecutar la logica por cada fila
		for {
			// Inicializar variables
			set glosa = "",
				onsetDate = ""

			// Hacer el fetch
			&sql(FETCH C2 INTO
				:idEpisodio,
				:idPaciente,
				:idEncuentro,
				:tipo,
				:fechaAtencion,
				:horaAtencion,
				:numEpisodio,
				:hospital,
				:local,
				:estado,
				:profesional,
				:motivoConsulta,
				:fin)

			// Manejar errores
			if (SQLCODE<0) {
				$$$logRBV("Error al hacer fetch. SQLCODE=", SQLCODE)
				&sql(CLOSE C2)
				quit
			}
			if (SQLCODE=100) {
				&sql(CLOSE C2)
				return tSC // No hay más registros
			}

			// Ejecutar logica por cada fila
			set diagnosticos = []
			set tSC = ..ObtenerDiagnosticos(idEncuentro, .diagnosticos)
			if (tSC '= $$$OK) $$$logRBV("tSC ObtenerDiagnosticos", $System.Status.GetErrorText(tSC))

			set medicamentos = []
			set tSC = ..ObtenerMedicamentos(idEpisodio, .medicamentos)
			if (tSC '= $$$OK) $$$logRBV("tSC ObtenerMedicamentos", $System.Status.GetErrorText(tSC))

			set indicaciones = []
			set tSC = ..ObtenerIndicaciones(idEpisodio, .indicaciones)
			if (tSC '= $$$OK) $$$logRBV("tSC ObtenerIndicaciones", $System.Status.GetErrorText(tSC))

			do encuentros.%Push(
				{
					"FechaHora": ($zdate(fechaAtencion,3)_" "_$ztime(horaAtencion,1)),
					"Tipo": (tipo),
					"NumEpisodio": (numEpisodio),
					"Estado": (estado),
					"Hospital": (hospital),
					"Local": (local),
					"Medico": (profesional),
					"Motivo Consulta": (motivoConsulta),
					"Diagnosticos": (diagnosticos),
					"Medicamentos": (medicamentos),
					"Indicaciones": (indicaciones)
				}
			)
		}

		// Cerrar el cursor
		&sql(CLOSE C2)

	} catch ex {
		set tSC = ex.AsStatus()
		&sql(CLOSE C2)
		$$$logRBV("tSC ObtenerEncuentros", $System.Status.GetErrorText(tSC))
	}

	return tSC
}

ClassMethod ObtenerAlergias(idPaciente As %Integer, Output alergias As %DynamicArray) As %Status
{
	// RBV ini Logs temporales para debug
	#define logRBV(%x,%y) set ^zRBV($increment(^zRBV),$ZDT($H,3,1),$zname,$piece($STACK($STACK,"PLACE"),"+",1),%x) = %y
	// RBV fin Logs temporales para debug

	set tSC = $$$OK
	set alergias = []

	// TODO: Modificar la query para ver si falta algun parametro importante (ingrediente, droga, otros)
	try {
		// Definir la query
		&sql(DECLARE C3 CURSOR FOR 
			select
			nvl(paa.ALG_Ingred_DR->INGR_Desc, nvl(paa.ALG_Type_DR->ALG_Desc, paa.ALG_PHCDM_DR->PHCD_Name)) "alergia",
			paa.ALG_Category_DR->ALRGCAT_Desc "tipo",
			paa.ALG_Severity_DR->ALRGSEV_Desc "severidad",
			ALG_OnsetDate,
			decode(ALG_Status,'A','true','I','false') "Status",
			'' "fin"
			from SQLUser.PA_Allergy paa
			where 1 = 1
			and paa.ALG_PAPMI_ParRef = :idPaciente
		)

		// Abrir el cursor
		&sql(OPEN C3)
		if (SQLCODE '= 0) {
			$$$logRBV("Error al abrir cursor. SQLCODE=", SQLCODE)
			quit
		}

		// Ejecutar la logica por cada fila
		for {
			// Inicializar variables
			set alergia = "",
				tipo = "",
				severidad = "",
				status = "",
				onsetDate = ""

			// Hacer el fetch
			&sql(FETCH C3 INTO
					:alergia,
					:tipo,
					:severidad,
					:onsetDate,
					:status,
					:fin)

			// Manejar errores
			if (SQLCODE<0) {
				$$$logRBV("Error al hacer fetch. SQLCODE=", SQLCODE)
				&sql(CLOSE C3)
				quit
			}
			if (SQLCODE=100) {
				&sql(CLOSE C3)
				quit // No hay más registros
			}

			// Ejecutar logica por cada fila
			//if ($get(tipo)'="") {
			//	set tipo = ##class(web.PACAllergySeverity).GetCodeDescriptionFromId(tipo)
			//	set tipo = $listGet(tipo,1)
			//}
			//if ($get(severidad)'="") {
			//	set severidad = ##class(web.PACAllergyCategory).GetCodeDescriptionFromId(severidad)
			//	set severidad = $listGet(severidad,1)
			//}
			do alergias.%Push(
				{
					"Alergia": (alergia),
					"Tipo": (tipo),
					"Severidad": (severidad),
					"FechaInicio": ($zdate(onsetDate,3)),
					"Activa": (status)
				}
			)
		}

		// Cerrar el cursor
		&sql(CLOSE C3)

	} catch ex {
		set tSC = ex.AsStatus()
		&sql(CLOSE C3)
		$$$logRBV("tSC ObtenerAlergias", $System.Status.GetErrorText(tSC))
	}

	return tSC
}

ClassMethod ObtenerDiagnosticos(idEncuentro As %Integer, Output diagnosticos As %DynamicArray) As %Status
{
	// RBV ini Logs temporales para debug
	#define logRBV(%x,%y) set ^zRBV($increment(^zRBV),$ZDT($H,3,1),$zname,$piece($STACK($STACK,"PLACE"),"+",1),%x) = %y
	// RBV fin Logs temporales para debug

	set tSC = $$$OK
	set diagnosticos = []
	set fechaInicio = $zdateh("2026-01-01",3)

	try {
		
		// Definir la query
		&sql(DECLARE C4 CURSOR FOR 
			select
			MRDIA_MRADM_ParRef,
			MRDIA_ICDCode_DR->MRCID_Code,
			MRDIA_ICDCode_DR->MRCID_Desc,
			MRDIA_Desc,
			MRDIA_DateDiagnosisIdentif,
			MRDIA_DiagnosisType_DR->DTYP_Desc,
			MRDIA_Active,
			'' "fin"
			from SQLUser.MR_Diagnos md
			where md.MRDIA_MRADM_ParRef = :idEncuentro
		)

		// Abrir el cursor
		&sql(OPEN C4)
		if (SQLCODE '= 0) {
			$$$logRBV("Error al abrir cursor. SQLCODE=", SQLCODE)
			quit
		}

		// Ejecutar la logica por cada fila
		for {
			// Inicializar variables
			set diagCIECode = "",
				diagCIEDesc = "",
				diagDesc = "",
				onsetDate = "",
				tipo = "",
				activo = ""

			// Hacer el fetch
			&sql(FETCH C4 INTO
				:idEncuentro,
				:diagCIECode,
				:diagCIEDesc,
				:diagDesc,
				:onsetDate,
				:tipo,
				:activo,
				:fin)

			// Manejar errores
			if (SQLCODE<0) {
				$$$logRBV("Error al hacer fetch. SQLCODE=", SQLCODE)
				&sql(CLOSE C4)
				quit
			}
			if (SQLCODE=100) {
				&sql(CLOSE C4)
				quit // No hay más registros
			}

			// Ejecutar logica por cada fila
			do diagnosticos.%Push(
				{
					"Glosa": (diagCIEDesc),
					"FechaInicio": ($zdate(onsetDate,3))
				}
			)
		}

		// Cerrar el cursor
		&sql(CLOSE C4)

	} catch ex {
		set tSC = ex.AsStatus()
	}

	return tSC
}

ClassMethod ObtenerMedicamentos(idEpisodio As %Integer, Output medicamentos As %DynamicArray) As %Status
{
	set tSC = $$$OK
	set medicamentos = []

	try {

		// Definir la query
		&sql(DECLARE C5 CURSOR FOR 
			select
			o.OEORD_Adm_DR,
			oi.OEORI_RowId,
			oi.OEORI_PrescNo,
			oi.OEORI_ItmMast_DR->ARCIM_Code,
			oi.OEORI_ItmMast_DR->ARCIM_Desc,
			oi.OEORI_Date,
			'' "fin"
			from SQLUser.OE_Order o
			join SQLUser.OE_OrdItem oi on o.OEORD_RowId = oi.OEORI_OEORD_ParRef
			join SQLUser.OE_OrdItem2 oi2 on oi.OEORI_RowId = oi2.ITM2_RowId
			where 1 = 1
			and oi.OEORI_ItmMast_DR->ARCIM_ItemCat_DR->ARCIC_OrdCat_DR->ORCAT_Code in (35) -- Farmacos
			and o.OEORD_Adm_DR = :idEpisodio
		)

		// Abrir el cursor
		&sql(OPEN C5)
		if (SQLCODE '= 0) {
			$$$logRBV("Error al abrir cursor. SQLCODE=", SQLCODE)
			quit
		}

		// Ejecutar la logica por cada fila
		for {
			// Inicializar variables
			set idOrden = 0,
				numPrescripcion = "",
				itemCode = "",
				itemDesc = "",
				fecha = ""

			// Hacer el fetch
			&sql(FETCH C5 INTO
				:idEpisodio,
				:idOrden,
				:numPrescripcion,
				:itemCode,
				:itemDesc,
				:fecha,
				:fin)

			// Manejar errores
			if (SQLCODE<0) {
				$$$logRBV("Error al hacer fetch. SQLCODE=", SQLCODE)
				&sql(CLOSE C5)
				quit
			}
			if (SQLCODE=100) {
				&sql(CLOSE C5)
				quit // No hay más registros
			}

			// Ejecutar logica por cada fila
			do medicamentos.%Push(
				{
					"Glosa": (itemDesc),
					"Fecha": ($zdate(fecha,3))
				}
			)
		}

		// Cerrar el cursor
		&sql(CLOSE C5)

	} catch ex {
		set tSC = ex.AsStatus()
	}

	return tSC
}

ClassMethod ObtenerIndicaciones(idEpisodio As %Integer, Output indicaciones As %DynamicArray) As %Status
{
	set tSC = $$$OK
	set indicaciones = []

	try {

		// Definir la query
		&sql(DECLARE C6 CURSOR FOR 
			select
			o.OEORD_Adm_DR,
			oi.OEORI_RowId,
			oi.OEORI_PrescNo,
			oi.OEORI_ItmMast_DR->ARCIM_Code,
			oi.OEORI_ItmMast_DR->ARCIM_Desc,
			oi.OEORI_Date,
			'' "fin"
			from SQLUser.OE_Order o
			join SQLUser.OE_OrdItem oi on o.OEORD_RowId = oi.OEORI_OEORD_ParRef
			join SQLUser.OE_OrdItem2 oi2 on oi.OEORI_RowId = oi2.ITM2_RowId
			where 1 = 1
			and oi.OEORI_ItmMast_DR->ARCIM_ItemCat_DR->ARCIC_OrdCat_DR->ORCAT_Code not in (35)
			and o.OEORD_Adm_DR = :idEpisodio
		)

		// Abrir el cursor
		&sql(OPEN C6)
		if (SQLCODE '= 0) {
			$$$logRBV("Error al abrir cursor. SQLCODE=", SQLCODE)
			quit
		}

		// Ejecutar la logica por cada fila
		for {
			// Inicializar variables
			set idOrden = 0,
				numPrescripcion = "",
				itemCode = "",
				itemDesc = "",
				fecha = ""

			// Hacer el fetch
			&sql(FETCH C6 INTO
				:idEpisodio,
				:idOrden,
				:numPrescripcion,
				:itemCode,
				:itemDesc,
				:fecha,
				:fin)

			// Manejar errores
			if (SQLCODE<0) {
				$$$logRBV("Error al hacer fetch. SQLCODE=", SQLCODE)
				&sql(CLOSE C6)
				quit
			}
			if (SQLCODE=100) {
				&sql(CLOSE C6)
				quit // No hay más registros
			}

			// Ejecutar logica por cada fila
			do indicaciones.%Push(
				{
					"Glosa": (itemDesc),
					"Fecha": ($zdate(fecha,3))
				}
			)
		}

		// Cerrar el cursor
		&sql(CLOSE C6)

	} catch ex {
		set tSC = ex.AsStatus()
	}

	return tSC
}

ClassMethod ObtenerNotasOffline(idEncuentro As %Integer = 23845, Output registrosOffline As %DynamicArray) As %Status
{
	// RBV ini Logs temporales para debug
	#define logRBV(%x,%y) set ^zRBV($increment(^zRBV),$ZDT($H,3,1),$zname,$piece($STACK($STACK,"PLACE"),"+",1),%x) = %y
	// RBV fin Logs temporales para debug

	//$$$logRBV("Inicio ObtenerNotasOffline", "-----------------------------")
	//$$$logRBV("idEncuentro", idEncuentro)

	set tSC = $$$OK
	set registrosOffline = []

	try {

		// Definir la query
		&sql(DECLARE C7 CURSOR FOR 
			select
			nn.NOT_Date,
			nn.NOT_Time,
			nn.NOT_NurseId_DR->CTPCP_Desc "Profesional",
			nn.NOT_Notes,
			'' "fin"
			from SQLUser.MR_NursingNotes nn
			where 1 = 1
			and nn.NOT_ClinNotesType_DR->CNT_Code = 'CLINICALNOTE'
			and nn.NOT_ClinNotesType_DR->CNT_Desc = 'TrakCare Offline'
			and nn.NOT_ParRef = :idEncuentro
		)

		// Abrir el cursor
		&sql(OPEN C7)
		if (SQLCODE '= 0) {
			$$$logRBV("Error al abrir cursor. SQLCODE=", SQLCODE)
			quit
		}

		// Ejecutar la logica por cada fila
		for {
			// Inicializar variables
			set fecha = "",
				hora = "",
				profesional = "",
				notas = ""

			// Hacer el fetch
			&sql(FETCH C7 INTO
				:fecha,
				:hora,
				:profesional,
				:notas,
				:fin)
			
			// Manejar errores
			if (SQLCODE<0) {
				$$$logRBV("Error al hacer fetch. SQLCODE=", SQLCODE)
				&sql(CLOSE C7)
				quit
			}
			if (SQLCODE=100) {
				&sql(CLOSE C7)
				quit // No hay más registros
			}

			// Los primeros caracteres al traer las NotasClinicas de la base de datos son caracteres de control, por lo que se eliminan antes de procesar el string
			set pos = $length(notas)+3-$find($reverse(notas),$char(1))
			if (pos>0) {
    			; Mantener todo el string posterior a los caracteres de control: ENQ/SOH o EOT/SOH o SOH/SOH
    			set notas = $extract(notas,pos,*)
			}

			// Los tags <br> se reemplazan por el estandar HL7
			set notas = $replace(notas,"<br>",$char(10))

			// Ejecutar logica por cada fila
			do registrosOffline.%Push(
				{
					"FechaHora": ($zdate(fecha,3)_" "_$ztime(hora,1)),
					"Profesional": (profesional),
					"Nota": (notas)
				}
			)
		}

		// Cerrar el cursor
		&sql(CLOSE C7)

	} catch ex {
		set tSC = ex.AsStatus()
		$$$logRBV("tSC ObtenerNotasOffline", $System.Status.GetErrorText(tSC))
	}

	//$$$logRBV("Fin    ObtenerNotasOffline", "-----------------------------")

	return tSC
}

ClassMethod ObtenerResultados(idEpisodio As %Integer, Output resultados As %DynamicArray) As %Status
{
	// RBV ini Logs temporales para debug
	#define logRBV(%x,%y) set ^zRBV($increment(^zRBV),$ZDT($H,3,1),$zname,$piece($STACK($STACK,"PLACE"),"+",1),%x) = %y
	// RBV fin Logs temporales para debug

	//$$$logRBV("Inicio ObtenerResultados", "-----------------------------")
	//$$$logRBV("idEpisodio", idEpisodio)

	set tSC = $$$OK
	set resultados = []

	//do resultados.%Push(
	//	{
	//		"FechaHora": "2026-01-15 10:20:00",
	//		"Tipo": "Funcional",
	//		"Examen": "Espirometria",
	//		"Valor": 58,
	//		"Unidad": "%",
	//		"RangoReferencia": ">80",
	//		"AbnormalFlag": "Bajo"
	//	}
	//)

	// TODO: Modificar la query para ver si falta algun parametro importante (ingrediente, droga, otros)
	try {
		// Definir la query
		&sql(DECLARE C8 CURSOR FOR 
			select
			oi.OEORI_LabEpisodeNo,
			oi.OEORI_Categ_DR->ORCAT_Desc,
			oi.OEORI_SubCateg_DR->ARCIC_Desc,
			oi.OEORI_ItmMast_DR->ARCIM_Code,
			oi.OEORI_ItmMast_DR->ARCIM_Desc,
			oi.OEORI_ResultFlag,
			oer.RES_ResultDate,
			oer.RES_ResultTime,
			vtd.VISTD_DisplaySequence,
			vtd.VISTD_TestCode_DR->CTTC_Desc,
			vtd.VISTD_TestCode_DR->CTTC_Units,
			vtd.VISTD_TestData,
			vtd.VISTD_Comments,
			case
				when ((vtd.VISTD_ResultRefRangeLow is not null) and (vtd.VISTD_ResultRefRangeHigh is     null)) then vtd.VISTD_ResultRefRangeLow
				when ((vtd.VISTD_ResultRefRangeLow is     null) and (vtd.VISTD_ResultRefRangeHigh is not null)) then vtd.VISTD_ResultRefRangeHigh
				when ((vtd.VISTD_ResultRefRangeLow is not null) and (vtd.VISTD_ResultRefRangeHigh is not null)) then vtd.VISTD_ResultRefRangeLow || ' - ' || vtd.VISTD_ResultRefRangeHigh
				else ''
			end "RangoReferencia",
			vtd.VISTD_ResultRefRangeLow,
			vtd.VISTD_ResultRefRangeHigh,
			vtd.VISTD_ClinicallySignificant,
			'' "fin"
			from SQLUser.PA_Adm pa
			left join SQLUser.OE_Order o on pa.PAADM_RowID = o.OEORD_Adm_DR
			left join SQLUser.OE_OrdItem oi on o.OEORD_RowId = oi.OEORI_OEORD_ParRef
			left join SQLUser.OE_Result oer on oi.OEORI_RowId = oer.RES_OrdItem_DR
			left join lab.EP_VisitTestSet vts on oi.OEORI_LabTestSetRow = vts.VISTS_RowId
			left join lab.EP_VisitTestSetData vtd on vts.VISTS_RowId = vtd.VISTD_ParRef
			where 1 = 1
			and pa.PAADM_RowId = :idEpisodio
			and oi.OEORI_LabEpisodeNo like 'L%'
			and oi.OEORI_ResultExist = 'Y'
		)

		// Abrir el cursor
		&sql(OPEN C8)
		if (SQLCODE '= 0) {
			$$$logRBV("Error al abrir cursor. SQLCODE=", SQLCODE)
			quit
		}

		// Ejecutar la logica por cada fila
		for {
			// Inicializar variables
			set labEpisodeNo = "",
				categoria = "",
				subcategoria = "",
				examenCode = "",
				examenDesc = "",
				resultFlag = "",
				resultDate = "",
				resultTime = "",
				displaySequence = "",
				testCodeDesc = "",
				testCodeUnits = "",
				testData = "",
				comments = "",
				referenceRange = "",
				refRangeLow = "",
				refRangeHigh = "",
				clinicallySignificant = ""

			// Hacer el fetch
			&sql(FETCH C8 INTO
					:labEpisodeNo,
					:categoria,
					:subcategoria,
					:examenCode,
					:examenDesc,
					:resultFlag,
					:resultDate,
					:resultTime,
					:displaySequence,
					:testCodeDesc,
					:testCodeUnits,
					:testData,
					:comments,
					:referenceRange,
					:refRangeLow,
					:refRangeHigh,
					:clinicallySignificant,
					:fin)

			// Manejar errores
			if (SQLCODE<0) {
				$$$logRBV("Error al hacer fetch. SQLCODE=", SQLCODE)
				&sql(CLOSE C8)
				quit
			}
			if (SQLCODE=100) {
				&sql(CLOSE C8)
				quit // No hay más registros
			}

			// Ejecutar logica por cada fila
			do resultados.%Push(
				{
					"FechaHora": ($zdate(resultDate,3)_" "_$ztime(resultTime,1)),
					"Tipo": (categoria_" - "_subcategoria),
					"Examen": (examenDesc _" ("_testCodeDesc_")"),
					"Valor": (testData),
					"Unidad": (testCodeUnits),
					"RangoReferencia": (referenceRange),
					"AbnormalFlag": (clinicallySignificant)
				}
			)
		}

		// Cerrar el cursor
		&sql(CLOSE C8)

	} catch ex {
		set tSC = ex.AsStatus()
		$$$logRBV("tSC ObtenerResultados", $System.Status.GetErrorText(tSC))
	}

	//$$$logRBV("Fin    ObtenerResultados", "-----------------------------")

	return tSC
}

ClassMethod RBVWriteToFile(pHL7 As %String) As %Status
{
    set tSC = $$$OK
    // Define default file path (adjust as needed)
    set tFilePath = "/trak/hmfdir/TrakINHL7/TrakCareOffline/hl7_message.txt"
    try {
        set tStream = ##class(%Stream.FileCharacter).%New()
        set tStream.Filename = tFilePath
        do tStream.Write(pHL7)
        do tStream.%Save()
    }catch ex {
        set tSC = ex.AsStatus()
    }
	quit tSC
}

ClassMethod RBVShowInterestingPaths()
{
    //set msgHL7 = "MSH|^~\\&|OFFLINE|LOCAL|CENTRAL|HOSPITAL|20260316165942||ADT^A28|MSG00004|P|2.5.1\rEVN|A28|20260316165942\rPID|1||OFFP1953|194-2|Barahona^Rodrigo^Vicencio||19770720|M\rPV1|1|N\r"
	set msgHL7 = "MSH|^~\\&|OFFLINE|LOCAL|CENTRAL|HOSPITAL|20260316165942||ADT^A01|14_A01|P|2.5.1\rEVN|A01|20260316165927\rPID|||OFFP1942|194-2|Rodrigo Larenas^||19770720000000|M\rPV1||E|Box X||||||||||||||||OFFE20260316165927||||||||||||||||||||||||||20260316165927\rPV2|||Dolor Abdominal\r"
    set msgHL7 = $Replace(msgHL7,"\r",$C(13))

    set msgHL7 = ##class(EnsLib.HL7.Message).ImportFromString(msgHL7,.sc)
    quit:$$$ISERR(sc) $System.Status.DisplayError(sc)

    set sc = msgHL7.PokeDocType("2.5.1:ADT_A01")
    quit:$$$ISERR(sc) $System.Status.DisplayError(sc)

    set sc = msgHL7.BuildMap()
    quit:$$$ISERR(sc) $System.Status.DisplayError(sc)

    do msgHL7.DumpMaps()
}

ClassMethod RBVTestORU() As %Status
{
	// RBV ini Logs temporales para debug
	#define logRBV(%x,%y) set ^zRBV($increment(^zRBV),$ZDT($H,3,1),$zname,$piece($STACK($STACK,"PLACE"),"+",1),%x) = %y
	// RBV fin Logs temporales para debug

    set sc = $$$OK

    set msgHL7 = "MSH|^~\&|ISC-TRAKCARE|ISC-TrakCare|ISC-TRAKCARE|ISC-TrakCare|20260310123000||ORU^R01^ORU_R01|MSG00002|P|2.5.1\rPID|1||000008180^^^^MR^^^||Moreno^Paulina^Silva||19720101|F\rPV1|1|E|||||||||||||||||U0000004273^^^^VN\rOBR|1|||CLINICALNOTE^Clinical Note^L|||20260310123000\rOBX|1|TX|CLINICALNOTE^Clinical Note^L||Mensaje de prueba de nota clínica desde IRIS.||||||F|||20260310123000"
    set msgHL7 = $Replace(msgHL7,"\r",$C(13))

    set msgHL7 = ##class(EnsLib.HL7.Message).ImportFromString(msgHL7,.sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
    set sc = msgHL7.PokeDocType("2.5.1:ORU_R01") return:$$$ISERR(sc) $System.Status.DisplayError(sc)

	set mrnPaciente = msgHL7.GetValueAt("PIDgrpgrp(1).PIDgrp.PID:3(1).1", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
	set episodio = msgHL7.GetValueAt("PIDgrpgrp(1).PIDgrp.PV1grp.PV1:19(1).1", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
	set notaOBX = msgHL7.GetValueAt("PIDgrpgrp(1).ORCgrp(1).OBXgrp(1).OBX:5", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
	set obr4Codigo = msgHL7.GetValueAt("PIDgrpgrp(1).ORCgrp(1).OBR:4.1", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
	set orb4Description = msgHL7.GetValueAt("PIDgrpgrp(1).ORCgrp(1).OBR:4.2", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
	set fechaHoraOBR = msgHL7.GetValueAt("PIDgrpgrp(1).ORCgrp(1).OBR:7", , .sc) return:$$$ISERR(sc) $System.Status.DisplayError(sc)
	set fechaOBR = +$extract(fechaHoraOBR,1,4)_"-"_$extract(fechaHoraOBR,5,6)_"-"_$extract(fechaHoraOBR,7,8)
	set horaOBR = +$extract(fechaHoraOBR,9,10)_":"_$extract(fechaHoraOBR,11,12)_":"_$extract(fechaHoraOBR,13,14)

	write !,"MRN: ", mrnPaciente
	write !,"Episodio: ", episodio
	write !,"Nota OBX: ", notaOBX
	write !,"OBR4 Código: ", obr4Codigo
	write !,"OBR4 Descripción: ", orb4Description
	write !,"Fecha/Hora OBR: ", fechaOBR, " ", horaOBR

    return sc
}

}
